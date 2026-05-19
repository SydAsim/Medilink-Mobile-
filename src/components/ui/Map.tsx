import React from "react";
import { StyleSheet, Image, View } from "react-native";

interface MapProps {
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
}

export default function Map({ latitude, longitude, title, description }: MapProps) {
  // Use Yandex Static Maps API to guarantee 100% reliable map loading 
  // on all environments (Web, Local Expo Go, Android Emulators, and Standalone APKs)
  // without needing any Google Maps API keys or Play Services authentication.
  const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=15&l=map&size=650,380&pt=${longitude},${latitude},pm2rdl`;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: staticMapUrl }}
        style={styles.mapImage}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
});
