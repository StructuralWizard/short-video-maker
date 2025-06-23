export enum AvailableComponentsEnum {
  PortraitVideo = "PortraitVideo",
  LandscapeVideo = "LandscapeVideo",
}
export type OrientationConfig = {
  width: number;
  height: number;
  component: AvailableComponentsEnum;
};
