import React from 'react';
import type { FC } from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame, 
  useVideoConfig,
  Audio,
  OffthreadVideo,
  Img,
  VideoConfig,
} from "remotion";
import { z } from "zod";
// Use local font instead of Google Fonts
// import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import "../../../fonts/fonts.css";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
  getOverlayUrl,
  getVideoUrl,
} from "../../shared/utils";

// Use local font instead of Google Fonts
const fontFamily = "'BenzGrotesk', sans-serif";

type Props = z.infer<typeof shortVideoSchema> & {
  config: {
    durationMs: number;
    paddingBack?: number;
    captionPosition?: "top" | "center" | "bottom";
    captionBackgroundColor?: string;
    captionTextColor?: string;
    musicVolume?: string;
    overlay?: string;
    port?: number;
    hook?: string;
  };
};

export const LandscapeVideo: FC<Props> = ({
  scenes,
  music,
  config,
}) => {
  // Validate input data
  console.log('[LandscapeVideo] Input validation:', {
    scenesLength: scenes?.length,
    scenes: scenes?.map((scene, i) => ({
      index: i,
      audioDuration: scene.audio?.duration,
      audioUrl: scene.audio?.url,
      videosLength: scene.videos?.length
    })),
    music,
    config
  });

  if (!scenes || scenes.length === 0) {
    console.error('[LandscapeVideo] No scenes provided');
    return <AbsoluteFill style={{ backgroundColor: "red" }}><div>No scenes</div></AbsoluteFill>;
  }

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Log para depuração do hook
  console.log('[LandscapeVideo] frame:', frame, 'config.hook:', config?.hook);

  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";
  const captionTextColor = config.captionTextColor ?? "#ffffff";

  const activeStyle = {
    backgroundColor: captionBackgroundColor,
    color: captionTextColor,
    padding: "10px 20px",
    marginLeft: "-10px",
    marginRight: "-10px",
    borderRadius: "50px",
    display: "inline-block",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
  };

  const captionPosition = config.captionPosition ?? "center";
  let captionStyle = {};
  if (captionPosition === "top") {
    captionStyle = { top: 100 };
  }
  if (captionPosition === "center") {
    captionStyle = { top: "50%", transform: "translateY(-50%)" };
  }
  if (captionPosition === "bottom") {
    captionStyle = { bottom: 100 };
  }

  const [musicVolume, musicMuted] = calculateVolume(config.musicVolume);

  // Calculate total duration including padding
  const totalDurationInFrames = Math.round(
    scenes.reduce((acc, curr) => acc + curr.audio.duration, 0) * fps
  ) + (config.paddingBack ? Math.round((config.paddingBack / 1000) * fps) : 0);

  // Ensure music starts from 0 if the start time would make it end before the video
  const startFrom = Math.min(music.start * fps, totalDurationInFrames - 1);

  const fadeOutDuration = 3; // segundos
  const fadeOutStartFrame = totalDurationInFrames - fadeOutDuration * fps;

  const finalVolume = (frame: number) => {
    if (frame >= fadeOutStartFrame) {
      // Interpola o volume de musicVolume até 0 nos últimos 2 segundos
      return (
        musicVolume * (totalDurationInFrames - frame) / (fadeOutDuration * fps)
      );
    }
    return musicVolume;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <Audio
        loop
        src={music.url}
        startFrom={startFrom}
        endAt={music.end * fps}
        volume={finalVolume(frame)}
        muted={musicMuted}
      />

      {config?.overlay && (
        <Img
          src={getOverlayUrl(config.overlay)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 1,
          }}
        />
      )}

      {config?.hook && frame === 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            {splitHookIntoBlocks(config.hook).map((block, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: block.fontSize,
                  fontFamily: block.isHighlighted ? "'BenzGrotesk', sans-serif" : "'BenzGrotesk', sans-serif",
                  fontStyle: "italic",
                  lineHeight: "0.8",
                  fontWeight: "900",
                  color: block.isHighlighted ? "#ffff00" : "#ffffff",
                  WebkitTextStroke: block.isHighlighted ? "4px #000000" : "4px #000000",
                  WebkitTextFillColor: block.isHighlighted ? "#ffff00" : "#ffffff",
                  textShadow: "5px 5px 20px #000000",
                  textAlign: "center",
                  width: "100%",
                  textTransform: "uppercase",
                  letterSpacing: "-0.05em",
                  opacity: 0.8,
                  marginBottom: "0.1em",
                  display: "block",
                }}
              >
                {block.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {scenes.map((scene, i) => {
        const { captions, audio, videos } = scene;
        const pages = createCaptionPages({
          captions,
          lineMaxLength: 30,
          lineCount: 1,
          maxDistanceMs: 1000,
        });

        // Calculate the start and end time of the scene
        const startFrame =
          scenes.slice(0, i).reduce((acc, curr) => {
            const duration = curr.audio?.duration || 0;
            const validDuration = isNaN(duration) ? 0 : duration;
            console.log(`[LandscapeVideo] Scene ${i} - reducing scene ${scenes.indexOf(curr)}: duration=${duration}, validDuration=${validDuration}, acc=${acc}`);
            return acc + validDuration;
          }, 0) * fps;
        
        // Ensure startFrame is finite
        const validStartFrame = isFinite(startFrame) ? startFrame : 0;
        
        const sceneDuration = scene.audio?.duration || 0;
        let durationInFrames = Math.max((isNaN(sceneDuration) ? 1 : sceneDuration), 0.1) * fps;
        if (config.paddingBack && i === scenes.length - 1) {
          durationInFrames += (config.paddingBack / 1000) * fps;
        }

        // Ensure minimum duration to prevent 0 duration errors
        durationInFrames = Math.max(durationInFrames, 1);
        
        // Additional safety check - if durationInFrames is still 0 or NaN, force it to 1
        if (durationInFrames <= 0 || isNaN(durationInFrames)) {
          console.error(`[LandscapeVideo] Scene ${i} has invalid durationInFrames: ${durationInFrames}, forcing to 1`);
          durationInFrames = 1;
        }

        // Debug logs
        console.log(`[LandscapeVideo] Scene ${i}:`, {
          sceneDuration,
          durationInFrames,
          startFrame,
          validStartFrame,
          fps,
          audioUrl: scene.audio?.url,
          audioDuration: scene.audio?.duration,
          scenesLength: scenes.length,
          i
        });

        return (
          <Sequence
            from={validStartFrame}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <OffthreadVideo 
                src={scene.videos[0]} 
                muted 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
            <Audio src={audio.url} />
            {pages.map((page, j) => {
              const pageStartMs = page.startMs ?? 0;
              const pageEndMs = page.endMs ?? 0;
              const pageDurationMs = Math.max(pageEndMs - pageStartMs, 0.001); // Minimum 1ms to avoid 0
              
              // Additional safety checks to prevent NaN values
              const validPageStartMs = isNaN(pageStartMs) ? 0 : Math.max(0, pageStartMs);
              const validPageEndMs = isNaN(pageEndMs) ? Math.max(validPageStartMs + 100, 100) : Math.max(pageEndMs, validPageStartMs + 100);
              const validPageDurationMs = Math.max(validPageEndMs - validPageStartMs, 0.001);
              
              const fromFrame = Math.round((validPageStartMs / 1000) * fps);
              const durationFrames = Math.max(1, Math.round((validPageDurationMs / 1000) * fps));
              
              // Final safety check - ensure fromFrame is finite
              if (!isFinite(fromFrame)) {
                console.error(`[LandscapeVideo] Scene ${i}, Page ${j}: Invalid fromFrame: ${fromFrame}, pageStartMs: ${pageStartMs}, validPageStartMs: ${validPageStartMs}`);
                return null; // Skip this page if we can't calculate valid timing
              }
              
              console.log(`[LandscapeVideo] Scene ${i}, Page ${j}:`, {
                pageStartMs,
                pageEndMs,
                validPageStartMs,
                validPageEndMs,
                fromFrame,
                durationFrames,
                fps
              });
              
              return (
                <Sequence
                  key={`scene-${i}-page-${j}`}
                  from={fromFrame}
                  durationInFrames={durationFrames}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      width: "100%",
                      ...captionStyle,
                      zIndex: 1001,
                    }}
                  >
                    {page.lines.map((line, k) => {
                      return (
                        <p
                          style={{
                            fontSize: "8em",
                            fontFamily: fontFamily,
                            fontWeight: "black",
                            color: captionTextColor,
                            WebkitTextStroke: "2px black",
                            WebkitTextFillColor: captionTextColor,
                            textShadow: "0px 0px 10px black",
                            textAlign: "center",
                            width: "100%",
                            textTransform: "uppercase",
                          }}
                          key={`scene-${i}-page-${j}-line-${k}`}
                        >
                          {line.texts.map((text, l) => {
                            const textStartMs = text.startMs || 0;
                            const textEndMs = text.endMs || 0;
                            const active =
                              frame >=
                                validStartFrame + (textStartMs / 1000) * fps &&
                              frame <= validStartFrame + (textEndMs / 1000) * fps;
                            return (
                              <>
                                <span
                                  style={{
                                    fontWeight: "bold",
                                    ...(active ? activeStyle : {}),
                                  }}
                                  key={`scene-${i}-page-${j}-line-${k}-text-${l}`}
                                >
                                  {text.text}
                                </span>
                                {l < line.texts.length - 1 ? " " : ""}
                              </>
                            );
                          })}
                        </p>
                      );
                    })}
                  </div>
                </Sequence>
              );
            })}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

function splitHookIntoBlocks(hook: string) {
  if (!hook) return [];
  
  const words = hook.split(/\s+/);
  const blocks: { text: string; fontSize: string; isHighlighted?: boolean }[] = [];
  let current = '';
  let i = 0;
  
  while (i < words.length) {
    let word = words[i];
    const match = word.match(/^\*(.+?)\*(\W*)$/);
    const isHighlighted = !!match;
    let cleanWord = word;
    if (isHighlighted) {
      cleanWord = match[1] + (match[2] || '');
    }
    const len = [...cleanWord].length;
    
    // If word is short (<=3 chars), try to combine with next word
    if (len <= 3 && i + 1 < words.length) {
      const nextWord = words[i + 1];
      const nextMatch = nextWord.match(/^\*(.+?)\*(\W*)$/);
      const nextIsHighlighted = !!nextMatch;
      const nextWordClean = nextIsHighlighted ? nextMatch[1] + (nextMatch[2] || '') : nextWord;
      if (isHighlighted || nextIsHighlighted || [...nextWordClean].length <= 3) {
        cleanWord = cleanWord + ' ' + nextWordClean;
        if (isHighlighted || nextIsHighlighted) {
          if (current) {
            blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
            current = '';
          }
          blocks.push({ 
            text: cleanWord, 
            fontSize: getFontSize([...cleanWord].length),
            isHighlighted: true 
          });
          i += 2;
          continue;
        }
        i++;
      }
    }
    
    const wordLen = [...cleanWord].length;
    let fontSize = '13em';
    if (wordLen > 12) fontSize = '5em';
    else if (wordLen > 9) fontSize = '8em';
    else if (wordLen > 7) fontSize = '11em';
    
    if (isHighlighted) {
      if (current) {
        blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
        current = '';
      }
      blocks.push({ text: cleanWord, fontSize, isHighlighted: true });
    } else if (wordLen > 7) {
      if (current) {
        blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
        current = '';
      }
      blocks.push({ text: cleanWord, fontSize });
    } else {
      if ((current + ' ' + cleanWord).trim().length > 7) {
        if (current) blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
        current = cleanWord;
      } else {
        current += (current ? ' ' : '') + cleanWord;
      }
    }
    i++;
  }
  
  if (current) blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
  return blocks;
}

function getFontSize(len: number) {
  if (len > 10) return '11em';
  if (len > 7) return '9em';
  return '13em';
}
