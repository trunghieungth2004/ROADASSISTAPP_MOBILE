import {useEffect, useRef, useState} from "react";
import {Animated, StyleSheet} from "react-native";

type Props = {
  visible: boolean;
  backgroundColor: string;
};

export default function MapStyleVeil({visible, backgroundColor}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {toValue: 0, duration: 150, useNativeDriver: true});
    animation.start();
    const timer = setTimeout(() => setMounted(false), 200);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [visible, opacity]);
  if (!mounted) return null;
  return <Animated.View style={[StyleSheet.absoluteFill, {backgroundColor, opacity}]} pointerEvents="none" />;
}
