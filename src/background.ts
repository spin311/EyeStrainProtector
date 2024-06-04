import Reason = chrome.offscreen.Reason;
import ContextType = chrome.runtime.ContextType;

const AUDIO_ACTIVE = "audioActive";
const SHOW_NOTIFICATION = "showNotification";
const AUDIO = "audio";
const VOLUME = "volume";
const ICON_URL = 'imgs/icon.png';
const TITLE = 'Preserve vision';
let creating: Promise<void> | null; // A global promise to avoid concurrency issues
let docExists: boolean = false;
let volume: number;
let audio: string;
let shouldSendNotification: boolean;
let shouldPlayAudio: boolean;
let minutesTimer: number = 20;
let notificationClosed: boolean = false;

chrome.notifications.onClicked.addListener((notificationId): void => {
    console.log('onClicked notificationClosed', notificationClosed);
    notificationClosed = true;
});

async function snoozeNotification(): Promise<void> {
    await chrome.alarms.clearAll();
    await chrome.alarms.create('snoozeAlarm', { delayInMinutes: 5 });
}

chrome.notifications.onButtonClicked.addListener(async (notificationId: string, buttonIndex: number) => {
    notificationClosed = true;
   if (buttonIndex === 0) {
            await snoozeNotification();
    }
});

chrome.notifications.onClosed.addListener((notificationId, byUser): void => {
    notificationClosed = true;
});

chrome.runtime.onMessage.addListener(handleMessages);
chrome.alarms.create('restAlarm', { periodInMinutes: minutesTimer });
chrome.runtime.onInstalled.addListener(async (details: { reason: string; }): Promise<void> => {
    chrome.runtime.onMessage.addListener(handleMessages);
    if(details.reason === "install"){
        await setInitialValues();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await chrome.tabs.create({url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true});
    }
});

chrome.runtime.onStartup.addListener(function(): void {
    chrome.runtime.onMessage.addListener(handleMessages);
});

function getMessage(duration: number): string {
    return `Time to rest your eyes! Look away at something 20 meters away for duration of this message (${duration}s)`;
}

async function handleMessages(message: { target: string; type: any; data?: any; }): Promise<void> {
    // Return early if this message isn't meant for the offscreen document.
    if (message.target !== 'background') {
        return;
    }
    // Dispatch the message to an appropriate handler.
    switch (message.type) {
        case 'play-sound':
            if (audio && volume) {
                await playAudio(audio, volume);
            }
            else {
                chrome.storage.sync.get([AUDIO, VOLUME], function (result): void {
                    if (result) {
                        audio = result[AUDIO];
                        volume = result[VOLUME] / 100;
                        if (audio && volume) {
                            playAudio(audio, volume);
                        }
                    }
                });
            }
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

function handleAlarmActions(): void {
    if (shouldSendNotification) {
        sendNotification();
    } else {
        chrome.storage.sync.get(SHOW_NOTIFICATION, function (result) {
            if (result) {
                shouldSendNotification = result[SHOW_NOTIFICATION];
                if (shouldSendNotification) {
                    sendNotification();
                }
            }
        });
    }
    if (shouldPlayAudio && audio && volume) {
        playAudio(audio, volume);
    } else {
        chrome.storage.sync.get([AUDIO_ACTIVE, VOLUME, AUDIO], function (result) {
            if (result) {
                shouldPlayAudio = result[AUDIO_ACTIVE];
                volume = result[VOLUME] / 100;
                audio = result[AUDIO];
                if (shouldPlayAudio && audio && volume) {
                    playAudio(audio, volume);
                }
            }
        });
    }
}

chrome.alarms.onAlarm.addListener(async (alarm): Promise<void> => {
    if (alarm.name === 'snoozeAlarm') {
        handleAlarmActions();
        await chrome.alarms.clear('snoozeAlarm');
        await chrome.alarms.create('restAlarm', { periodInMinutes: minutesTimer });
    }
    else if (alarm.name === 'restAlarm') {
        handleAlarmActions();
    }
});


async function setInitialValues(): Promise<void> {
    await Promise.all([
        chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
        chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
        chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
        chrome.storage.sync.set({ [VOLUME]: 100 }),
    ]);

}

async function sendNotification(): Promise<void> {
    const iconUrl: string = chrome.runtime.getURL(ICON_URL);
    let duration: number = 20;
    notificationClosed = false;
    for (let i = 0; i < 4; i++) {
        console.log('SendNotification notificationClosed', notificationClosed);
        if (notificationClosed) {
            break;
        }
        await new Promise((resolve): void => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: iconUrl,
                title: TITLE,
                buttons: [{title: 'Snooze (5min)'},{ title: 'Close' }],
                message: getMessage(duration)
            }, function(notificationId: string): void {
                setTimeout((): void => {
                    chrome.notifications.clear(notificationId);
                    duration -= 5;
                    resolve(null);
                }, 5000);
            });
        });
    }
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
