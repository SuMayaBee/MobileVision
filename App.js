import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Image, TouchableOpacity } from "react-native";
import { Camera, CameraType } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import React, { useState, useEffect, useRef } from "react";
import Button from "./src/components/Button";
import * as FileSystem from "expo-file-system";
import { Audio, Video, AVPlaybackStatus } from "expo-av";
import axios from "axios";
import { Buffer } from 'buffer';
import Tts from 'react-native-tts';
import * as Speech from 'expo-speech';


export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [flash, setFlash] = useState(Camera.Constants.FlashMode.off);
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef(null);
  const [hasAudioPermission, setHasAudioPermission] = useState(null);
  const [record, setRecord] = useState(null);
  const [status, setStatus] = React.useState({});
  const [videoPreview, setVideoPreview] = useState(false);
  const intervalId = useRef(null);

  useEffect(() => {
    (async () => {
      MediaLibrary.requestPermissionsAsync();
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus.status === "granted");

      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      setHasAudioPermission(audioStatus.status === "granted");
    })();
  }, []);

  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  if (hasAudioPermission === false) {
    return <Text>No access to audio</Text>;
  }

  const toBuffer = async (blob) => {
    const uri = await toDataURI(blob);
    const base64 = uri.replace(/^.*,/g, "");
    return Buffer.from(base64, "base64");
  };
  
  const toDataURI = (blob) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const uri = reader.result?.toString();
        resolve(uri);
      };
    });
  
  const constructTempFilePath = async (buffer) => {
    const tempFilePath = FileSystem.cacheDirectory + "speech.mp3";
    await FileSystem.writeAsStringAsync(
      tempFilePath,
      buffer.toString("base64"),
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );
  
    return tempFilePath;
  };

  const sendImageToBackend = async (base64Image) => {
    try {
      // Send the base64 image to the backend
      const uploadResponse = await fetch(
        "http://10.0.0.101:8000/upload_image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: base64Image,
          }),
        }
      );

      const uploadData = await uploadResponse.json();
      console.log(uploadData);

      // Get the image details from the backend
      const detailsResponse = await fetch(
        "http://10.0.0.101:8000/image_details"
      );
      const detailsData = await detailsResponse.text(); // Get the response as text
      console.log(detailsData);

      const options = {
        voice: "com.apple.speech.synthesis.voice.Fred",
        pitch: 1.1,
        rate: 1
      };


      Speech.speak(detailsData, options);

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync();
        console.log(data);
        setImage(data.uri);

        const base64 = await FileSystem.readAsStringAsync(data.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        //console.log(base64);
        const imageData = `data:image/jpeg;base64,${base64}`;
        //console.log(imageData.substring(0, 1000));

        const options = {
          voice: "com.apple.speech.synthesis.voice.Fred",
          pitch: 1,
          rate: 1
        };
   
        Speech.speak('Picture is taken', options);

      } catch (e) {
        console.log(e);
      }
    }
  };

  const saveImage = async () => {
    if (image) {
      try {
        await MediaLibrary.createAssetAsync(image);
        alert("Image saved to gallery");
        setImage(null);
      } catch (e) {
        console.log(e);
      }
    }
  };

  const saveVideo = async () => {
    if (video) {
      try {
        await MediaLibrary.createAssetAsync(video);
        alert("Video saved to gallery");
        setVideo(null);
      } catch (e) {
        console.log(e);
      }
    }
  };

  const imageToBase64 = async (imageUri) => {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  };

  const recordVideo = async () => {
    if (cameraRef.current) {
      if (isRecording) {
        setIsRecording(false);
        clearTimeout(timeoutId.current); // Stop capturing images
      } else {
        setIsRecording(true);
        const captureImage = async () => {
          const data = await cameraRef.current.takePictureAsync();
          const base64 = await imageToBase64(data.uri);
          await sendImageToBackend(base64); // Send the image to the backend
          timeoutId.current = setTimeout(captureImage, 6000); // Schedule the next image capture
        };
        captureImage(); // Capture image immediately
      }
    }
  };

  return (
    <View style={styles.container}>
      {!image ? (
        <Camera
          style={styles.camera}
          type={type}
          flashMode={flash}
          ref={cameraRef}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 30,
            }}
          >
            <Button
              icon={"retweet"}
              onPress={() =>
                setType(
                  type === Camera.Constants.Type.back
                    ? Camera.Constants.Type.front
                    : Camera.Constants.Type.back
                )
              }
            />

            <Button
              icon={"flash"}
              color={
                flash === Camera.Constants.FlashMode.off ? "gray" : "#f1f1f1"
              }
              onPress={() => {
                setFlash(
                  flash === Camera.Constants.FlashMode.off
                    ? Camera.Constants.FlashMode.on
                    : Camera.Constants.FlashMode.off
                );
              }}
            />
          </View>
        </Camera>
      ) : (
        <Image source={{ uri: image }} style={styles.camera} />
      )}

      <View>
        {image ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 50,
            }}
          >
            <Button
              title={"Re-take"}
              icon="retweet"
              onPress={() => setImage(null)}
            />
            <Button title={"Save"} icon="check" onPress={saveImage} />
          </View>
        ) : (
          <View>
            {isRecording ? (
              <Button
                title={"Stop Recording"}
                icon="video"
                onPress={recordVideo}
              />
            ) : (
              <View>
                <Button
                  title={"Take a picture"}
                  icon="camera"
                  onPress={takePicture}
                />
                <Button
                  title={"Start Recording"}
                  icon="video"
                  onPress={recordVideo}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    paddingBottom: 20,
  },
  camera: {
    flex: 1,
    borderRadius: 20,
  },
});
