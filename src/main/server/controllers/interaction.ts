import * as alt from 'alt-server';
import { Events } from '@Shared/events/index.js';
import { useTranslate } from '@Shared/translate.js';
import * as Utility from '@Shared/utility/index.js';

export type InteractionCallback = (entity: alt.Player, colshape: alt.Colshape, uid: string) => void;

type InteractionInternal = {
    uid: string;
    handleEnter: (player: alt.Player) => void;
    handleLeave: (player: alt.Player) => void;
    handleInteract: (player: alt.Player) => void;
    type: 'vehicle' | 'player' | 'any';
};

const SessionKey = 'colshape:uid';
const interactions: Array<InteractionInternal> = [];
const { t } = useTranslate('en');

function getIndex(colshape: alt.Colshape): number {
    if (!colshape.valid) {
        return -1;
    }

    const uid = colshape.getMeta(SessionKey);
    if (!uid) {
        return -1;
    }

    return interactions.findIndex((x) => x.uid === uid);
}

function isValid(entity: alt.Entity, interaction: InteractionInternal) {
    if (!(entity instanceof alt.Player)) {
        return false;
    }

    let valid = false;

    if (interaction.type === 'player' && !entity.vehicle) {
        valid = true;
    }

    if (interaction.type === 'vehicle' && entity.vehicle && entity.vehicle.driver === entity) {
        valid = true;
    }

    if (interaction.type === 'any') {
        valid = true;
    }

    return valid;
}

function onEnter(colshape: alt.Colshape, entity: alt.Entity) {
    const index = getIndex(colshape);
    if (index <= -1) {
        return;
    }

    const interaction = interactions[index];
    if (!isValid(entity, interaction)) {
        return;
    }

    interaction.handleEnter(entity as alt.Player);
}

function onLeave(colshape: alt.Colshape, entity: alt.Entity) {
    const index = getIndex(colshape);
    if (index <= -1) {
        return;
    }

    const interaction = interactions[index];
    if (!isValid(entity, interaction)) {
        return;
    }

    interaction.handleLeave(entity as alt.Player);
}

function onInteract(player: alt.Player, uid: string) {
    const index = interactions.findIndex((x) => x.uid === uid);
    if (index <= -1) {
        return;
    }

    interactions[index].handleInteract(player);
}

export function useInteraction(colshape: alt.Colshape, type: 'vehicle' | 'player' | 'any', uid: string = undefined) {
    if (!uid) {
        uid = Utility.uid.generate();
    }

    const callbacks: InteractionCallback[] = [];
    const shape = colshape;
    shape.playersOnly = false;
    shape.setMeta(SessionKey, uid);

    let msgEnter = t('controller.interaction.message');
    let msgLeave = undefined;

    function handleEnter(player: alt.Player) {
        player.emit(Events.controllers.interaction.set, uid, msgEnter, colshape.pos);
    }

    function handleLeave(player: alt.Player) {
        player.emit(Events.controllers.interaction.set, uid, msgLeave, colshape.pos);
    }

    function handleInteract(player: alt.Player) {
        if (!colshape.isEntityIn(player)) {
            return;
        }

        for (let cb of callbacks) {
            cb(player, colshape, uid);
        }
    }

    function on(callback: InteractionCallback) {
        callbacks.push(callback);
    }

    function destroy() {
        const index = getIndex(shape);
        if (index >= 0) {
            interactions.splice(index, 1);
        }

        try {
            shape.destroy();
        } catch (err) {}
    }

    function setMessage(type: 'enter' | 'leave', msg: string) {
        if (type === 'enter') {
            msgEnter = msg;
            return;
        }

        msgLeave = msg;
    }

    interactions.push({ handleEnter, handleLeave, handleInteract, uid, type });

    return {
        on,
        destroy,
        setMessage,
        type,
        uid,
    };
}

alt.on('entityEnterColshape', onEnter);
alt.on('entityLeaveColshape', onLeave);
alt.onClient(Events.controllers.interaction.trigger, onInteract);
