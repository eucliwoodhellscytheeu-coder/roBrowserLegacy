import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import PathFinding from 'Utils/PathFinding.js';
import PartyFriends from 'UI/Components/PartyFriends/PartyFriends.js';

function canAttackPlayer(entity, player) {
	const map = Session.mapState || {};
	if (map.isPVP || map.isGVG) {
		return entity.canAttackEntity();
	}
	// Older map-property packets may identify a PvP zone without the newer flags.
	if (map.isPVPZone) {
		return !(Session.hasParty && PartyFriends.isGroupMember(entity.display.name));
	}
	if (map.isAgitZone) {
		return (player.GUID > 0 && entity.GUID !== player.GUID) || entity.GUID === 0;
	}
	return false;
}

/** Attack the nearest reachable monster or eligible PvP opponent. */
export default function attackNearestTarget() {
	const player = Session.Entity;
	if (!player) {
		return false;
	}

	let target = null;
	let path = null;
	let distance = Infinity;
	EntityManager.forEach(entity => {
		if (
			entity.GID === player.GID ||
			(entity.objecttype !== Entity.TYPE_MOB &&
				(entity.objecttype !== Entity.TYPE_PC || !canAttackPlayer(entity, player))) ||
			entity.action === entity.ACTION.DIE ||
			entity.isDeath ||
			entity.isHide ||
			entity.remove_tick
		) {
			return true;
		}
		const candidateDistance = Math.hypot(
			entity.position[0] - player.position[0],
			entity.position[1] - player.position[1]
		);
		if (candidateDistance >= distance) {
			return true;
		}
		const candidatePath = [];
		const count = PathFinding.search(
			player.position[0] | 0,
			player.position[1] | 0,
			entity.position[0] | 0,
			entity.position[1] | 0,
			player.attack_range,
			candidatePath
		);
		if (!count) {
			return true;
		}
		target = entity;
		path = candidatePath.slice(0, count * 2);
		distance = candidateDistance;
		return true;
	});
	if (!target) {
		return false;
	}

	const previous = EntityManager.getFocusEntity();
	if (previous !== target) {
		previous?.onFocusEnd();
		target.onFocus();
		EntityManager.setFocusEntity(target);
	}

	const modern = PACKETVER.value >= 20180307;
	const attack = modern ? new PACKET.CZ.REQUEST_ACT2() : new PACKET.CZ.REQUEST_ACT();
	attack.action = 7;
	attack.targetGID = target.GID;
	if (path.length === 2) {
		Session.moveAction = null;
		Network.sendPacket(attack);
	} else {
		Session.moveAction = attack;
		const move = modern ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE();
		move.dest[0] = path[path.length - 2];
		move.dest[1] = path[path.length - 1];
		Network.sendPacket(move);
	}
	return true;
}
