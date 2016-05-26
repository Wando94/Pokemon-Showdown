var serverIp = '';
var MD5 = require('MD5');
var http = require('http');
var formatHex = '#000000'; //hex code for the formatting of the command
var css = 'border:none;background:none;padding:0;float:left;';
var geoip = require('geoip-ultralight');
var moment = require('moment');
geoip.startWatchingDataUpdate();

exports.commands = {
	profile: function(target, room, user) {
		if (!target) target = user.name;
		if (toId(target).length > 19) return this.sendReply("Usernames may not be more than 19 characters long.");
		if (toId(target).length < 1) return this.sendReply(target + " is not a valid username.");
		if (!this.canBroadcast()) return;
		
		var targetUser = Users.get(target);
		
		if (!targetUser) {
			var username = target;
			var userid = toId(target);
			var online = false;
			var avatar = (Config.customavatars[userid] ? "http://" + serverIp + ":" + Config.port + "/avatars/" + Config.customavatars[userid] : "http://play.pokemonshowdown.com/sprites/trainers/167.png");
		} else {
			var username = targetUser.name;
			var userid = targetUser.userid;
			var online = targetUser.connected;
			var avatar = (isNaN(targetUser.avatar) ? "http://" + serverIp + ":" + Config.port + "/avatars/" + targetUser.avatar : "http://play.pokemonshowdown.com/sprites/trainers/" + targetUser.avatar + ".png");
		}

    	if (Users.usergroups[userid]) {
			var userGroup = Users.usergroups[userid].substr(0,1);
			if (Config.groups[userGroup]) userGroup = Config.groups[userGroup].name; 
		} else {
			var userGroup = 'Regular User';
		}

		var self = this;
		var options = {
			host: "pokemonshowdown.com",
			port: 80,
			path: "/users/" + userid
		};

		var content = "";
		var req = http.request(options, function(res) {

			res.setEncoding("utf8");
			res.on("data", function (chunk) {
				content += chunk;
			});
			res.on("end", function () {
				content = content.split("<em");
				if (content[1]) {
					content = content[1].split("</p>");
					if (content[0]) {
						content = content[0].split("</em>");
						if (content[1]) {
							regdate = content[1].trim();
							showProfile();
						}
					}
				} else {
					regdate = '(Unregistered)';
					showProfile();
				}
			});
		});
		req.end();
		function getFlag (flagee) {
			if (!Users(flagee)) return false;
			if (Users(flagee)) {
				var geo = geoip.lookupCountry(Users(flagee).latestIp);
				if (!geo) {
					return false;
				} else {
					return ' <img src="https://github.com/kevogod/cachechu/blob/master/flags/' + geo.toLowerCase() + '.png?raw=true" height=10 title="' + geo + '">';
				}
			}

		}
		function showProfile() {
			var seenOutput = '';					
			var profile = '';
                        profile += '<img src="' + avatar + '" height=80 width=80 align=left>';
			if (!getFlag(toId(username))) profile += '&nbsp;<font color=' + formatHex + '><b>Name:</b></font> <b><font color="' + hashColor(toId(username)) + '">' + Tools.escapeHTML(username) + '</font></b><br />';
			if (getFlag(toId(username))) profile += '&nbsp;<font color=' + formatHex + '><b>Name:</b></font> <b><font color="' + hashColor(toId(username)) + '">' + Tools.escapeHTML(username) + '</font></b>' + getFlag(toId(username)) + '<br />';
			profile += '&nbsp;<font color=' + formatHex + '><b>Registered:</b></font> ' + regdate + '<br />';
			if (!Users.vips[userid]) profile += '&nbsp;<font color=' + formatHex + '><b>Rank: </font></b>' + userGroup + '<br />';
			if (Users.vips[userid]) profile += '&nbsp;<font color=' + formatHex + '><b>Rank: </font></b>' + userGroup + ' (<font color=#800000><b>Inferno DEV</b></font>)<br />';
			if (online) profile += '&nbsp;<font color=' + formatHex + '><b>Status: </font></b><font color=green>Currently Online</font><br />';
			if (!online) profile += '&nbsp;<font color=' + formatHex + '><b>Status: </font></b><font color=red><b>OFFLINE</b><br />';
			profile += '<br clear="all">';
			self.sendReplyBox(profile);
			room.update();
		}
	},

	economycode: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("Economy code by: <a href=\"https://gist.github.com/jd4564/d6e8f4140b7abc9295e1\">jd</a>");
	}
};

var colorCache = {};
hashColor = function (name) {
	name = toId(name);
    if (colorCache[name]) return colorCache[name];

    var hash = MD5(name);
    var H = parseInt(hash.substr(4, 4), 16) % 360;
    var S = parseInt(hash.substr(0, 4), 16) % 50 + 50;
    var L = parseInt(hash.substr(8, 4), 16) % 20 + 25;

    var rgb = hslToRgb(H, S, L);
    colorCache[name] = "#" + rgbToHex(rgb.r, rgb.g, rgb.b);
    return colorCache[name];
}

function hslToRgb(h, s, l) {
    var r, g, b, m, c, x

    if (!isFinite(h)) h = 0
    if (!isFinite(s)) s = 0
    if (!isFinite(l)) l = 0

    h /= 60
    if (h < 0) h = 6 - (-h % 6)
    h %= 6

    s = Math.max(0, Math.min(1, s / 100))
    l = Math.max(0, Math.min(1, l / 100))

    c = (1 - Math.abs((2 * l) - 1)) * s
    x = c * (1 - Math.abs((h % 2) - 1))

    if (h < 1) {
        r = c
        g = x
        b = 0
    } else if (h < 2) {
        r = x
        g = c
        b = 0
    } else if (h < 3) {
        r = 0
        g = c
        b = x
    } else if (h < 4) {
        r = 0
        g = x
        b = c
    } else if (h < 5) {
        r = x
        g = 0
        b = c
    } else {
        r = c
        g = 0
        b = x
    }

    m = l - c / 2
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)

    return {
        r: r,
        g: g,
        b: b
    }
}

function rgbToHex(R, G, B) {
    return toHex(R) + toHex(G) + toHex(B)
}

function toHex(N) {
    if (N == null) return "00";
    N = parseInt(N);
    if (N == 0 || isNaN(N)) return "00";
    N = Math.max(0, N);
    N = Math.min(N, 255);
    N = Math.round(N);
    return "0123456789ABCDEF".charAt((N - N % 16) / 16) + "0123456789ABCDEF".charAt(N % 16);
}
