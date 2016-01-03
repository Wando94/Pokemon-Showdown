
/*
* Poll chat plugin
* This plugin allows roomauth (default: driver and above) to run a poll in a room.
* Every room can have one poll, and every user can vote. The results are displayed for
* users that have voted, and are updated in real time. The poll can be closed with /endpoll.
* By bumbadadabum with (a lot of) help from Zarel.
*/

var permission = 'broadcast';
var bluebutton = 'padding:2px; background-color:#0099FF; border:1px solid #0099FF; color:white';

var Poll = (function () {
	function Poll(room, question, options) {
		if (room.pollNumber) {
			room.pollNumber++;
		} else {
			room.pollNumber = 1;
		}
		this.room = room;
		this.question = question;
		this.voters = new Set();
		this.totalVotes = 0;
		this.timeout = null;

		this.options = new Map();
		for (var i = 0; i < options.length; i++) {
			this.options.set(i + 1, {name: options[i], votes: 0});
		}
	}

	Poll.prototype.vote = function (user, option) {
		if (this.voters.has(user.latestIp)) {
			return user.sendTo(this.room, "You have already voted for this poll.");
		} else {
			this.voters.add(user.latestIp);
		}

		this.options.get(option).votes++;
		this.totalVotes++;

		this.update();
	};

	Poll.prototype.generateVotes = function () {
		var output = '<div class="infobox"><p style="margin: 2px 0 5px 0"><span style="border:1px solid #6A6;color:#484;border-radius:4px;padding:0 3px"><i class="fa fa-bar-chart"></i> Poll</span> <strong style="font-size:11pt">' + Tools.escapeHTML(this.question) + '</strong></p>';
		this.options.forEach(function (option, number) {
			output += '<div style="margin-top: 3px"><button style="' + bluebutton + '" value="/poll vote ' + number + '" name="send" title="Vote for ' + number + '. ' + Tools.escapeHTML(option.name) + '">' + number + '. <strong>' + Tools.escapeHTML(option.name) + '</strong></button></div>';
		});
		output += '</div>';

		return output;
	};

	Poll.prototype.generateResults = function (ended) {
		var icon = '<span style="border:1px solid #' + (ended ? '777;color:#555' : '6A6;color:#484') + ';border-radius:4px;padding:0 3px"><i class="fa fa-bar-chart"></i> ' + (ended ? "Poll ended" : "Poll") + '</span>';
		var output = '<div class="infobox"><p style="margin: 2px 0 5px 0">' + icon + ' <strong style="font-size:11pt">' + Tools.escapeHTML(this.question) + '</strong></p>';
		var iter = this.options.entries();

		var i = iter.next();
		var c = 0;
		var colors = ['#79A', '#8A8', '#88B'];
		while (!i.done) {
			var percentage = Math.round((i.value[1].votes * 100) / (this.totalVotes || 1));
			output += '<div style="margin-top: 3px"><span>' + i.value[0] + '. <strong>' + Tools.escapeHTML(i.value[1].name) + '</strong></span> <small style="font-size:8pt;padding-left:6px"> | ' + percentage + '% (' + i.value[1].votes + ' votes)</small><br /><span style="background:' + colors[c % 3] + ';padding-right:' + (percentage * 3) + 'px"></span></div>';
			i = iter.next();
			c++;
		}
		output += '</div>';

		return output;
	};

	Poll.prototype.update = function () {
		var results = this.generateResults();

		// Update the poll results for everyone that has voted
		for (var i in this.room.users) {
			var user = this.room.users[i];
			if (this.voters.has(user.latestIp)) {
				user.sendTo(this.room, '|uhtmlchange|poll' + this.room.pollNumber +  '|' + results);
			}
		}
	};

	Poll.prototype.display = function (user, broadcast) {
		var votes = this.generateVotes();
		var results = this.generateResults();

		var target = {};

		if (broadcast) {
			target = this.room.users;
		} else {
			target[0] = user;
		}

		for (var i in target) {
			var thisUser = target[i];
			if (this.voters.has(thisUser.latestIp)) {
				thisUser.sendTo(this.room, '|uhtml|poll' + this.room.pollNumber +  '|' + results);
			} else {
				thisUser.sendTo(this.room, '|uhtml|poll' + this.room.pollNumber +  '|' + votes);
			}
		}
	};

	Poll.prototype.end = function () {
		var results = this.generateResults(true);

		this.room.send('|uhtmlchange|poll' + this.room.pollNumber +  '|<div class="infobox">(The poll has ended &ndash; scroll down to see the results)</div>');
		this.room.send('|html|' + results);
	};

	return Poll;
})();

exports.commands = {
	poll: {
		create: 'new',
		new: function (target, room, user) {
			if (target.length > 1024) return this.errorReply("Poll too long.");
			var params = target.split(target.includes('|') ? '|' : ',').map(function (param) { return param.trim(); });

			if (!this.can(permission, null, room)) return false;
			if (room.poll) return this.errorReply("There is already a poll in progress in this room.");

			if (params.length < 3) {
				return this.errorReply("Not enough arguments for /poll new.");
			}

			var options = [];

			for (var i = 1; i < params.length; i++) {
				options.push(params[i]);
			}

			if (options.length > 15) {
				return this.errorReply("Too many options for poll (maximum is 12).");
			}

			room.poll = new Poll(room, params[0], options);
			room.poll.display(user, true);
			return this.privateModCommand("(A poll was started by " + user.name + ".)");
		},
		newhelp: ["/poll create [question], [option1], [option2], [...] - Creates a poll. Requires: % @ # & ~"],

		vote: function (target, room, user) {
			if (!room.poll) return this.errorReply("There is no poll running in this room.");
			if (!target) return this.errorReply("Please specify an option.");

			var parsed = parseInt(target);
			if (isNaN(parsed)) return this.errorReply("To vote, specify the number of the option.");

			if (!room.poll.options.has(parsed)) return this.sendReply("Option not in poll.");

			room.poll.vote(user, parsed);
		},
		votehelp: ["/poll vote [number] - Votes for option [number] in the poll. This can also be done by clicking the option in the poll itself."],

		close: 'end',
		stop: 'end',
		end: function (target, room, user) {
			if (!this.can(permission, null, room)) return false;
			if (!room.poll) return this.errorReply("There is no poll running in this room.");

			room.poll.end();
			delete room.poll;
			return this.privateModCommand("(The poll was ended by " + user.name + ".)");
		},
		endhelp: ["/poll end - Ends a poll and displays the results. Requires: % @ # & ~"],
		
		timer: function (target, room, user) {
			if (!this.can(permission, null, room)) return false;
			if (!room.poll) return this.errorReply("There is no poll running in this room.");

			var timeout = parseFloat(target);
			if (isNaN(timeout)) return this.errorReply("No time given.");
			if (room.poll.timeout) clearTimeout(room.poll.timeout);
			room.poll.timeout = setTimeout((function () {
				room.poll.end();
				delete room.poll;
			}), (timeout * 60000));
			return this.privateModCommand("(The timeout was set to " + timeout + " minutes by " + user.name + ".)");
		},
		timerhelp: ["/poll timer [minutes] - Sets the poll to automatically end after [minutes] minutes. Requires: % @ # & ~"],

		pr: 'display',
		pollremind: 'display',
		display: function (target, room, user) {
			if (!room.poll) return this.errorReply("There is no poll running in this room.");
			if (!this.canBroadcast()) return;
			room.update();

			room.poll.display(user, this.broadcasting);
		},
		displayhelp: ["/poll display - Displays the poll"],

		'': function (target, room, user) {
			this.parse('/help poll new');
			this.parse('/help poll end');
		},
	},
	pollhelp: function(target, room, user) {
		if (!this.canBroadcast()) return;
		return this.sendReplyBox(
			"/poll allows rooms to run their own polls. These polls are limited to one poll at a time per room.<br />" +
			"The poll status is displayed to the users and updated in real time.<br />" +
			"Accepts the following commands:<br />" +
			"/poll create [question], [option1], [option2], [...] - Creates a poll. Requires: + % @ # & ~<br />" +
			"/poll vote [number] - Votes for option [number].<br />" +
			"/poll timer [minutes] - Sets the poll to automatically end after [minutes]. Requires: + % @ # & ~<br />" +
			"/poll display - Displays the poll<br />" +
			"/poll end - Ends a poll and displays the results. Requires: + % @ # & ~"
		)
	},
	votes: function(target, room, user) {
		if (!room.poll) return this.errorReply("There is no poll running in this room.");
		if (!this.canBroadcast()) return;
		var votes = room.poll.totalVotes;
		var lbl = (votes > 1 ? ' VOTES' : ' VOTE');
		return this.sendReplyBox("TOTAL VOTES: " + votes + lbl);
	},
	ep: 'endpoll',
	endpoll: function(target, room, user) {
		this.parse('/poll end');
	},
	oraspoll: function(target, room, user) {
		var tiers = ['Random Battle', 'OU', 'Ubers', 'UU', 'RU', 'NU', 'LC', 'Anything Goes', 'Battle Spot Singles'];
		this.parse('/poll new ORAS Single tier?, ' + tiers);

	},
	tierpoll: function(target, room, user) {
		var tiers = ['Anything Goes', 'Random Triples Battle', 'Challenge Cup 1v1', 'Monotype', 'Ubers','Overused', 'Underused','Rarelyused','Neverused','Pu' ,'Random Battles','Catch And EvolveP', 'Eights', 'Gen One Random / 0MM', ];
		this.parse('/poll new Next Tour?, ' + tiers);
       },
       ompoll: function(target, room, user) {
		var tiers = ['CAP', 'Balanced Hackmons', '1v1', 'Monotype', 'Tier Shift', 'PU', 'Inverse Battle', 'Almost Any Ability', 'STABmons', 'LC UU', 'Snowy OU'];
		this.parse('/poll new Other Metas Tournament?, ' + tiers);
	},

	easytour: 'etour',
	elimtour: 'etour',
	etour: function (target, room, user) {
		if (!this.can('broadcast', null, room)) return;
		this.parse('/tour new ' + target + ', elimination');
	},

	roundrobintour: 'rtour',
	cancertour: 'rtour',
	rtour: function (target, room, user) {
		if (!this.can('broadcast', null, room)) return;
		this.parse('/tour new ' + target + ', roundrobin');
}
};
