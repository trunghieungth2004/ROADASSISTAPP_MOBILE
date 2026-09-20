import {registerRootComponent} from "expo";
import {Logger} from "@maplibre/maplibre-react-native";
import App from "./App";
Logger.setLogLevel("error");
registerRootComponent(App);
