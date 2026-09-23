import {registerRootComponent} from "expo";
import {LogManager} from "@maplibre/maplibre-react-native";
import App from "./App";
LogManager.setLogLevel("error");
registerRootComponent(App);
