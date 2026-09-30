import {Layer} from "@maplibre/maplibre-react-native";
import {splitLayerStyle, type FlatLayerStyle} from "../map/layerStyle";

type Props = {
  type: "line" | "fill" | "symbol" | "circle";
  id: string;
  beforeId?: string;
  style: FlatLayerStyle;
};

export default function StyledLayer(props: Props) {
  const {paint, layout} = splitLayerStyle(props.style);
  if (props.type === "fill") return <Layer type="fill" id={props.id} beforeId={props.beforeId} paint={paint} layout={layout} />;
  if (props.type === "symbol") return <Layer type="symbol" id={props.id} beforeId={props.beforeId} paint={paint} layout={layout} />;
  if (props.type === "circle") return <Layer type="circle" id={props.id} beforeId={props.beforeId} paint={paint} layout={layout} />;
  return <Layer type="line" id={props.id} beforeId={props.beforeId} paint={paint} layout={layout} />;
}
