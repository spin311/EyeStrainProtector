"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let notifTime = 5;
document.addEventListener('DOMContentLoaded', function () {
    return __awaiter(this, void 0, void 0, function* () {
        const autoAudio = document.getElementById('autoAudio');
        const selectAudio = document.getElementById('selectAudio');
        const playAudio = document.getElementById('playAudio');
        const toggleActive = document.getElementById('toggleActive');
        const showNotification = document.getElementById('showNotification');
        const volume = document.getElementById('volume');
        const reminderTime = document.getElementById('reminderTime');
        const snoozeTime = document.getElementById('snoozeTime');
        const notificationTime = document.getElementById('notificationTime');
        if (autoAudio) {
            yield setAudioCheckbox(autoAudio);
        }
        if (selectAudio) {
            yield setAudioOption(selectAudio);
        }
        if (showNotification) {
            yield setShowNotification(showNotification);
        }
        if (volume) {
            yield setVolume(volume);
        }
        if (reminderTime) {
            chrome.storage.sync.get('reminderTime', function (result) {
                if (result.reminderTime) {
                    reminderTime.value = result.reminderTime;
                }
            });
            reminderTime.addEventListener('change', function () {
                chrome.storage.sync.set({ 'reminderTime': reminderTime.value });
            });
        }
        if (snoozeTime) {
            chrome.storage.sync.get('snoozeTime', function (result) {
                if (result.snoozeTime) {
                    snoozeTime.value = result.snoozeTime;
                }
            });
            snoozeTime.addEventListener('change', function () {
                chrome.storage.sync.set({ 'snoozeTime': snoozeTime.value });
            });
        }
        if (notificationTime) {
            chrome.storage.sync.get('notificationTime', function (result) {
                if (result.notificationTime) {
                    notifTime = result.notificationTime;
                    notificationTime.value = result.notificationTime;
                }
            });
            notificationTime.addEventListener('change', function () {
                notifTime = Number(notificationTime.value);
                chrome.storage.sync.set({ 'notificationTime': notifTime });
            });
        }
        if (toggleActive) {
            const result = yield chrome.storage.sync.get('active');
            if (!result['active']) {
                toggleActive.classList.add('off');
            }
            else {
                toggleActive.classList.remove('off');
            }
            toggleActive.addEventListener('click', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const result = yield chrome.storage.sync.get('active');
                    const active = result['active'];
                    yield chrome.storage.sync.set({ 'active': !active });
                    toggleActive.classList.toggle('off');
                    yield chrome.runtime.sendMessage({
                        type: 'toggle-active',
                        target: 'background',
                        data: !active
                    });
                });
            });
        }
        if (playAudio) {
            playAudio.addEventListener('click', testAlert);
        }
    });
});
function disableButtonForAudioDuration() {
    const playAudio = document.getElementById('playAudio');
    playAudio.disabled = true;
    playAudio.classList.remove('btn-success');
    playAudio.classList.add('btn-fail');
    setTimeout(() => {
        playAudio.disabled = false;
        playAudio.classList.remove('btn-fail');
        playAudio.classList.add('btn-success');
    }, notifTime * 5000);
}
function testAlert() {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.runtime.sendMessage({
            type: 'play-sound',
            target: 'background',
        });
        yield chrome.runtime.sendMessage({
            type: 'show-notification',
            target: 'background',
        });
        disableButtonForAudioDuration();
    });
}
function setVolume(volume) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get('volume');
        const vol = result['volume'];
        if (vol !== undefined) {
            volume.value = String(vol);
        }
        volume.addEventListener('change', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ['volume']: parseFloat(volume.value) });
            });
        });
    });
}
function setAudioOption(selectAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get('audio');
        selectAudio.value = result['audio'];
        selectAudio.addEventListener('change', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ['audio']: selectAudio.value });
            });
        });
    });
}
function setAudioCheckbox(autoAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get('audioActive');
        autoAudio.checked = result['audioActive'];
        autoAudio.addEventListener('click', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ['audioActive']: autoAudio.checked });
            });
        });
    });
}
function setShowNotification(showNotification) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get('showNotification');
        showNotification.checked = result['showNotification'];
        showNotification.addEventListener('click', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ['showNotification']: showNotification.checked });
            });
        });
    });
}
