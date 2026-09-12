import { appDestination } from '@/appLinks';
export function redirectSystemPath({path}:{path:string;initial:boolean}){
  // Relative internal routes are handled by Expo Router; external input is allowlisted.
  return appDestination(path)||'/';
}
