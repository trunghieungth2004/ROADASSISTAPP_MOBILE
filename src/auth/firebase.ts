import {getApps, initializeApp} from "firebase/app";
import {getAuth, getReactNativePersistence, initializeAuth, type Auth} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {config} from "../config";

const app = getApps().length > 0 ? getApps()[0] : initializeApp({apiKey: config.firebase.apiKey, authDomain: config.firebase.authDomain, projectId: config.firebase.projectId});

let auth: Auth;
try {
  auth = initializeAuth(app, {persistence: getReactNativePersistence(AsyncStorage)});
} catch {
  auth = getAuth(app);
}

export {auth};
