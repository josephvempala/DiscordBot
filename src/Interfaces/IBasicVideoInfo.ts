export interface IBasicVideoInfo {
    url: string,
    title: string,
    length: number,
    isLiveStream: boolean,
    type: VideoInfoType
}

export enum VideoInfoType {
    Spotify,
    YouTube,
    SoundCloud,
    Mixlr
}