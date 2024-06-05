import Reason = chrome.offscreen.Reason;
import ContextType = chrome.runtime.ContextType;

const AUDIO_ACTIVE = "audioActive";
const SHOW_NOTIFICATION = "showNotification";
const AUDIO = "audio";
const VOLUME = "volume";
const ICON_URL = 'imgs/icon.png';
const TITLE = 'Preserve vision';
const NOTIFICATION_TIME = 'notificationTime';
const SNOOZE_TIME = 'snoozeTime';
const REST_ALARM = 'restAlarm';
const SNOOZE_ALARM = 'snoozeAlarm';
const REMINDER_TIME = 'reminderTime';
let creating: Promise<void> | null; // A global promise to avoid concurrency issues
let docExists: boolean = false;
let volume: number;
let audio: string;
let shouldSendNotification: boolean;
let shouldPlayAudio: boolean;
let minutesTimer: number = 20;
let snoozeTime: number;
let notificationClosed: boolean = false;
let notificationCount: number;

async function snoozeNotification(): Promise<void> {
    await chrome.alarms.clearAll();
    await chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: snoozeTime });
}
chrome.runtime.onMessage.addListener(handleMessages);

chrome.notifications.onClicked.addListener((notificationId: string): void => {
    notificationClosed = true;
});

chrome.notifications.onButtonClicked.addListener(async (_notificationId: string, buttonIndex: number): Promise<void> => {
    notificationClosed = true;
   if (buttonIndex === 0) {
            await snoozeNotification();
    }
});

chrome.runtime.onInstalled.addListener(async (details: { reason: string; }): Promise<void> => {
    await chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
    if(details.reason === "install"){
        await setInitialValues();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await chrome.tabs.create({url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true});
    }
});

chrome.runtime.onStartup.addListener(async function(): Promise<void> {
    minutesTimer = await getMinutesTimer();
    await chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
});

chrome.storage.onChanged.addListener(async(changes, areaName : chrome.storage.AreaName): Promise<void> => {
    if (areaName === 'sync') {
        for (let key in changes) {
            const storageChange: chrome.storage.StorageChange = changes[key];
            switch (key) {
                case SNOOZE_TIME:
                    snoozeTime = Number(storageChange.newValue);
                    break;
                case REMINDER_TIME:
                    minutesTimer = Number(storageChange.newValue);
                    await chrome.alarms.clearAll();
                    await chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
                    break;
                case AUDIO:
                    audio = String(storageChange.newValue);
                    break;
                case VOLUME:
                    volume = Number(storageChange.newValue) / 100;
                    break;
                case AUDIO_ACTIVE:
                    shouldPlayAudio = Boolean(storageChange.newValue);
                    break;
                case SHOW_NOTIFICATION:
                    shouldSendNotification = Boolean(storageChange.newValue);
                    break;
                case NOTIFICATION_TIME:
                    notificationCount = Number(storageChange.newValue);
                    break;
            }
        }

    }
});

function getSnoozeMessage(duration: number): string {
    return `Snooze (${duration}min) `;
}

async function getMinutesTimer(): Promise<number> {
    return await new Promise((resolve): void => {
        chrome.storage.sync.get(REMINDER_TIME, function (result): void {
            resolve(Number(result[REMINDER_TIME]) || 20);
        });
    });
}

async function toggleActive(active: boolean): Promise<void> {
    await chrome.alarms.clearAll();
    if (active) {
        await chrome.action.setIcon({path: '/imgs/icon.png'});
        minutesTimer = await getMinutesTimer();
        await chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
    }
    else {
        await chrome.action.setIcon({path: '/imgs/iconbw.png'});
    }
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
            await sendNotification();
            break;
        case 'toggle-active':
            await toggleActive(message.data);
            break;

    }
}

async function playAudio(audio:string='alert1.mp3',volume: number = 1.0): Promise<void> {

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
        chrome.storage.sync.get(SHOW_NOTIFICATION, function (result): void {
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
        chrome.storage.sync.get([AUDIO_ACTIVE, VOLUME, AUDIO], function (result): void {
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

chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm): Promise<void> => {
    if (alarm.name === SNOOZE_ALARM) {
        handleAlarmActions();
        await chrome.alarms.clear(SNOOZE_ALARM);
        await chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
    }
    else if (alarm.name === REST_ALARM) {
        handleAlarmActions();
    }
});


async function setInitialValues(): Promise<void> {
    await Promise.all([
        chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
        chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
        chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
        chrome.storage.sync.set({ [VOLUME]: 100 }),
        chrome.storage.sync.set({ [NOTIFICATION_TIME]: 4 }),
        chrome.storage.sync.set({ [SNOOZE_TIME]: 5 }),
        chrome.storage.sync.set({ REMINDER_TIME: 20 }),
        chrome.storage.sync.set({ 'active': true })
        
    ]);

}

function getMessage(duration: number): string {
    return `Time to rest your eyes! Look away at something 20 meters away for duration of this message (${duration}s)`;
}

async function getNotificationCount(): Promise<number> {
    return new Promise((resolve, reject): void => {
        chrome.storage.sync.get(NOTIFICATION_TIME, function (result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(Number(result[NOTIFICATION_TIME]) || 4);
            }
        });
    });
}

async function getSnoozeTime(): Promise<number> {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(SNOOZE_TIME, function (result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(Number(result[SNOOZE_TIME]) || 5);
            }
        });
    });
}

async function sendNotification(): Promise<void> {
    const iconUrl: string = chrome.runtime.getURL(ICON_URL);
    if (!notificationCount) {
        notificationCount = await getNotificationCount();
    }

    if (!snoozeTime) {
        snoozeTime = await getSnoozeTime();
    }
    let duration: number = notificationCount * 5;
    notificationClosed = false;
    for (let i: number = 0; i < notificationCount; i++) {
        if (notificationClosed) {
            break;
        }
        await new Promise((resolve): void => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: iconUrl,
                title: TITLE,
                buttons: [{title: getSnoozeMessage(snoozeTime)},{ title: 'Close' }],
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
    const existingContexts: chrome.runtime.ExtensionContext[] = await chrome.runtime.getContexts({
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
