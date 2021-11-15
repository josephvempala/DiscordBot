export interface IBasicVideoInfo {
    url: string,
    title: string,
    length: number,
    type: VideoInfoType
}

export enum VideoInfoType {
    Spotify,
    YouTube,
    SoundCloud
}