import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';

import Box from '@mui/material/Box';
import { makeStyles } from 'tss-react/mui';

import { VideoPlayerSettings } from 'main/types';
import { getConfigValue, setConfigValue } from 'settings/useSettings';
import { DialogContentText } from '@mui/material';
import { CopyBlock, dracula } from 'react-code-blocks';

import {
  videoTabsSx,
  categoryTabSx,
  categoryTabsSx,
  videoScrollButtonSx,
} from '../main/constants';

import { VideoCategory } from '../types/VideoCategory';
import VideoButton from './VideoButton';
import poster from '../../assets/poster/poster.png';
import InformationDialog from './InformationDialog';
import LogButton from './LogButton';
import DiscordButton from './DiscordButton';

/**
 * For shorthand referencing.
 */
const ipc = window.electron.ipcRenderer;

/**
 * Needed to style the tabs with the right color.
 */
const useStyles = makeStyles()({
  tabs: {
    '& .MuiTab-root.Mui-selected': {
      color: '#bb4220',
    },
    scrollButtons: {
      // this does nothing atm
      '&.Mui-disabled': {
        opacity: 1,
      },
    },
  },
});

/**
 * TabPanelProps
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * MUI TabPanel
 */
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      className="TabPanel"
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0, width: '100%' }}>
          <Typography component="span" sx={{ width: '100%' }}>
            {children}
          </Typography>
        </Box>
      )}
    </div>
  );
};

/**
 * Some MUI specific props.
 */
const a11yProps = (index: number) => {
  return {
    id: `vertical-tab-${index}`,
    'aria-controls': `vertical-tabpanel-${index}`,
  };
};

/**
 * Get video player settings initially when the component is loaded. We store
 * as a variable in main rather than in config It's fine if this is lost when
 * the app is restarted.
 */
const videoPlayerSettings = ipc.sendSync('videoPlayerSettings', [
  'get',
]) as VideoPlayerSettings;
const selectedCategory = getConfigValue<number>('selectedCategory');

let videoState: { [key: string]: any } = {};

/**
 * The GUI itself.
 */
export default function Layout() {
  const [state, setState] = React.useState({
    autoPlay: false,
    categoryIndex: selectedCategory,
    videoIndex: 0,
    videoState,
    videoMuted: videoPlayerSettings.muted,
    videoVolume: videoPlayerSettings.volume, // (Double) 0.00 - 1.00
    videoSeek: 0,
    fatalError: false,
    fatalErrorText: '',
  });

  const getVideoPlayer = () => {
    return document.getElementById('video-player') as HTMLMediaElement;
  };

  /**
   * Read and store the video player state of 'volume' and 'muted' so that we may
   * restore it when selecting a different video.
   */
  const handleVideoPlayerVolumeChange = (event: any) => {
    const videoPlayerSettings = {
      muted: event.target.muted,
      volume: event.target.volume,
    };

    state.videoMuted = videoPlayerSettings.muted;
    state.videoVolume = videoPlayerSettings.volume;

    ipc.sendMessage('videoPlayerSettings', ['set', videoPlayerSettings]);
  };

  /**
   * Update the state variable following a change of selected category.
   */
  const handleChangeCategory = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setConfigValue('selectedCategory', newValue);

    setState((prevState) => {
      return {
        ...prevState,
        autoPlay: false,
        categoryIndex: newValue,
        videoIndex: 0,
      };
    });
  };

  /**
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setState((prevState) => {
      return {
        ...prevState,
        autoPlay: true,
        videoIndex: newValue,
        videoSeek: 0,
      };
    });
  };

  const categories = Object.values(VideoCategory);
  const category = categories[state.categoryIndex];

  /**
   * MUI styles.
   */
  const { classes: styles } = useStyles();

  // This is effectively equivalent to componentDidMount() in
  // React Component classes
  React.useEffect(
    () => {
      /**
       * Refresh handler.
       */
      ipc.on('refreshState', async () => {
        videoState = await ipc.invoke('getVideoState', []);

        setState((prevState) => {
          return {
            ...prevState,
            autoPlay: false,
            videoState,
          };
        });
      });

      ipc.on('fatalError', async (stack) => {
        setState((prevState) => {
          return {
            ...prevState,
            fatalError: true,
            fatalErrorText: stack as string,
          };
        });
      });

      /**
       * Attach listener for seeking in the video on load/unload
       */
      ipc.on('seekVideo', (vIndex, vSeekTime) => {
        setState((prevState) => {
          return {
            ...prevState,
            videoIndex: parseInt(vIndex as string, 10),
            videoSeek: parseInt(vSeekTime as string, 10),
          };
        });
      });
    },
    // From React documentation:
    //
    // > It's important to note the empty array as second argument for the
    // > Effect Hook which makes sure to trigger the effect only on component
    // > load (mount) and component unload (unmount).
    []
  );

  /**
   * When a new video is selected, let's set the video player volume and mute state
   */
  React.useEffect(() => {
    const video = getVideoPlayer();
    if (video) {
      video.muted = state.videoMuted;
      video.volume = state.videoVolume;
    }
  }, [state.videoIndex]);

  React.useEffect(() => {
    const videoPlayer = getVideoPlayer();
    if (videoPlayer) {
      videoPlayer.currentTime = state.videoSeek;
    }
  }, [state.videoSeek]);

  /**
   * Returns TSX for the tab buttons for category selection.
   */
  const generateTab = (tabIndex: number) => {
    const key = `tab${tabIndex}`;

    return (
      <Tab
        key={key}
        label={categories[tabIndex]}
        {...a11yProps(tabIndex)}
        sx={{ ...categoryTabSx }}
      />
    );
  };

  /**
   * Returns a video panel where no videos are present.
   */
  const noVideoPanel = (index: number) => {
    const { categoryIndex } = state;
    const key = `noVideoPanel${index}`;

    return (
      <TabPanel key={key} value={categoryIndex} index={index}>
        <div className="video-container">
          <video key="None" className="video" poster={poster} />
        </div>
        <div className="noVideos" />
      </TabPanel>
    );
  };

  /**
   * Returns a video panel with videos.
   */
  const videoPanel = (index: number) => {
    const { autoPlay } = state;
    const { categoryIndex } = state;
    const { videoIndex } = state;
    const categoryState = state.videoState[category];
    const video = state.videoState[category][state.videoIndex];
    const videoFullPath = video.fullPath;
    const key = `videoPanel${index}`;
    const isMythicPlus =
      video.category === VideoCategory.MythicPlus &&
      video.challengeMode !== undefined;

    return (
      <TabPanel key={key} value={categoryIndex} index={index}>
        <div
          className={`video-container${isMythicPlus ? ' mythic-keystone' : ''}`}
        >
          <video
            autoPlay={autoPlay}
            key={videoFullPath}
            preload="auto" 
            id="video-player"
            className="video"
            poster={poster}
            onVolumeChange={handleVideoPlayerVolumeChange}
            controls
          >
            <source src={videoFullPath} />
          </video>
        </div>
        <Tabs
          value={videoIndex}
          onChange={handleChangeVideo}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="scrollable auto tabs example"
          sx={{ ...videoTabsSx }}
          className={styles.tabs}
          TabIndicatorProps={{ style: { background: '#bb4220' } }}
          TabScrollButtonProps={{ disabled: false, sx: videoScrollButtonSx }}
        >
          {categoryState.map((file: any) => {
            return (
              <VideoButton
                key={file.fullPath}
                state={state}
                index={file.index}
              />
            );
          })}
        </Tabs>
      </TabPanel>
    );
  };

  /**
   * Returns TSX for the video player and video selection tabs.
   */
  const generateTabPanel = (tabIndex: number) => {
    if (!(category in state.videoState)) {
      return noVideoPanel(tabIndex);
    }

    const haveVideos = state.videoState[category][state.videoIndex];

    if (!haveVideos) {
      return noVideoPanel(tabIndex);
    }

    return videoPanel(tabIndex);
  };

  const quitApplication = () => ipc.sendMessage('mainWindow', ['quit']);

  const tabNumbers = [...Array(8).keys()];
  const { categoryIndex } = state;

  return (
    <>
      <Box sx={{ width: '250px', height: '240px', display: 'flex' }}>
        <Tabs
          orientation="vertical"
          variant="standard"
          value={categoryIndex}
          onChange={handleChangeCategory}
          aria-label="Vertical tabs example"
          sx={{ ...categoryTabsSx }}
          className={styles.tabs}
          TabIndicatorProps={{ style: { background: '#bb4220' } }}
        >
          {tabNumbers.map((tabNumber: number) => {
            return generateTab(tabNumber);
          })}
        </Tabs>

        {tabNumbers.map((tabNumber: number) => {
          return generateTabPanel(tabNumber);
        })}
      </Box>
      <InformationDialog
        title="😭 Fatal Error"
        open={state.fatalError}
        buttons={['quit']}
        onClose={quitApplication}
      >
        <DialogContentText component="span">
          Warcraft Recorder hit a problem it can not recover from and needs to
          close.
          <br />
          <br />
          To get help with this issue, please share the following in the Discord
          help channel:
          <ul>
            <li>The error text shown below</li>
            <li>The application log, click the log button to find them</li>
          </ul>
          <CopyBlock
            text={state.fatalErrorText}
            language="JavaScript"
            showLineNumbers={false}
            theme={dracula}
          />
          <div className="app-buttons-fatal-error">
            <LogButton />
            <DiscordButton />
          </div>
        </DialogContentText>
      </InformationDialog>
    </>
  );
}
