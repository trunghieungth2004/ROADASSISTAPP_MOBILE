import {forwardRef} from "react";
import {StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextProps, type TextInputProps, type TextStyle} from "react-native";
import {Roboto_400Regular, Roboto_500Medium, Roboto_700Bold} from "@expo-google-fonts/roboto";

export const APP_FONTS = {Roboto_400Regular, Roboto_500Medium, Roboto_700Bold};

function familyFor(style: StyleProp<TextStyle>): string {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const w = flat?.fontWeight;
  const n = typeof w === "string" ? (w === "bold" ? 700 : w === "normal" ? 400 : parseInt(w, 10)) : (w ?? 400);
  if (n >= 700) return "Roboto_700Bold";
  if (n >= 500) return "Roboto_500Medium";
  return "Roboto_400Regular";
}

export const AppText = forwardRef<RNText, TextProps>(function AppText({style, ...rest}, ref) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const {fontWeight: _w, ...restStyle} = flat ?? {};
  void _w;
  return <RNText ref={ref} {...rest} style={[{fontFamily: familyFor(style), fontWeight: "normal"}, restStyle]} />;
});

export const AppTextInput = forwardRef<RNTextInput, TextInputProps>(function AppTextInput({style, ...rest}, ref) {
  return <RNTextInput ref={ref} {...rest} style={[{fontFamily: "Roboto_400Regular"}, style]} />;
});
