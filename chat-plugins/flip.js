exports.commands = {
  flip: function (target, room, user) {
    if (!target) return this.parse("/help flip");
    if (!this.canBroadcast()) return;
    return this.sendReplyBox('You input: ' + target + ' The result was: ' + target.split("").reverse().join(""));
  },
};
