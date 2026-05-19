import React from "react";
import { StyleSheet, View } from "react-native";

interface MapProps {
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
}

export default function Map({ latitude, longitude, title, description }: MapProps) {
  // Use beautiful Google Maps Embed API for a seamless web browser coordinate lock
  const mapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

  return (
    <View style={styles.container}>
      <iframe
        title="Google Maps Web Preview"
        src={mapUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
  },
});
