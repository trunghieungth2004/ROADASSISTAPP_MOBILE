import {Image, Pressable, View, type ImageStyle, type StyleProp} from "react-native";
import type {AppTheme} from "../../theme";
import {usePhotoUrl} from "../../services/photos";

type Props = {
  path: string;
  theme: AppTheme;
  style: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  onPress?: (path: string) => void;
};

export default function PhotoThumb({path, theme, style, accessibilityLabel, onPress}: Props) {
  const uri = usePhotoUrl(path, {thumb: true});
  if (uri === "") {
    return <View style={[style, {backgroundColor: theme.border}]} />;
  }
  const image = <Image source={{uri}} style={style} />;
  if (onPress === undefined) return image;
  return (
    <Pressable onPress={() => onPress(path)} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {image}
    </Pressable>
  );
}
