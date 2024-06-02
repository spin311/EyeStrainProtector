import Reason = chrome.offscreen.Reason;
import ContextType = chrome.runtime.ContextType;

const AUDIO_ACTIVE = "audioActive";
const SHOW_NOTIFICATION = "showNotification";
const AUDIO = "audio";
const ICON_URL = 'imgs/logo.png';
const TITLE = 'Prolific Studies';
const MESSAGE = 'Time to rest your eyes! Look away at something 20 meters away for 20 seconds!';
let creating: Promise<void> | null; // A global promise to avoid concurrency issues
let docExists: boolean = false;
let volume: number = 1.0;
let audio: string = 'alert1.mp3';
let shouldSendNotification: boolean = true;
let shouldPlayAudio: boolean = true;
let minutesTimer: number = 1;

chrome.runtime.onMessage.addListener(handleMessages);

chrome.runtime.onInstalled.addListener(async (details: { reason: string; }): Promise<void> => {
    if(details.reason === "install"){
        await setInitialValues();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await chrome.tabs.create({url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true});
    }
});


async function handleMessages(message: { target: string; type: any; data?: any; }): Promise<void> {
    // Return early if this message isn't meant for the offscreen document.
    if (message.target !== 'background') {
        return;
    }
    // Dispatch the message to an appropriate handler.
    switch (message.type) {
        case 'play-sound':
            await playAudio(audio, volume);
            break;
        case 'show-notification':
            sendNotification();
            break;
        case 'audio-changed':
            audio = message.data;
            break;
        case 'volume-changed':
            volume = message.data;
            break;
        case 'showNotification-changed':
            shouldSendNotification = message.data;
            break;
        case 'audioActive-changed':
            shouldPlayAudio = message.data;
            break;
    }
}

async function playAudio(audio:string='alert1.mp3',volume: number = 1.0) {

    await setupOffscreenDocument('audio/audio.html');
    const req = {
        audio: audio,
        volume: volume
    };
    await chrome.runtime.sendMessage({
        type: 'play-sound',
        target: 'offscreen-doc',
        data: req
    });
}

setInterval(() => {
    if (shouldPlayAudio) {
        playAudio(audio, volume);
    }
    if (shouldSendNotification) {
        sendNotification();
    }
}, minutesTimer * 60 * 1000);


async function setInitialValues(): Promise<void> {
    await Promise.all([
        chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
        chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
        chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
        chrome.storage.sync.set({ ['volume']: 100 }),
    ]);

}

chrome.runtime.onStartup.addListener(function(){
    chrome.storage.sync.get(null, function (result) {
        if (result) {
            if (result[AUDIO_ACTIVE] !== undefined) {
                shouldPlayAudio = result[AUDIO_ACTIVE];
            }
            if (result[AUDIO] !== undefined) {
                audio = result[AUDIO];
            }
            if (result[SHOW_NOTIFICATION] !== undefined) {
                shouldSendNotification = result[SHOW_NOTIFICATION];
            }
            if (result['volume'] !== undefined) {
                volume = result['volume'] / 100;
            }
        }
    });
});

function sendNotification(): void {
    const iconUrl: string = chrome.runtime.getURL(ICON_URL);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: iconUrl,
        title: TITLE,
        message: MESSAGE
    });
}

async function setupOffscreenDocument(path: string): Promise<void> {
    // Check all windows controlled by the service worker to see if one
    // of them is the offscreen document with the given path
    const offscreenUrl: string = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        docExists = true;
        return;
    }
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [Reason.AUDIO_PLAYBACK],
            justification: 'Audio playback'
        });
        await creating;
        creating = null;
        docExists = true;
    }
}
