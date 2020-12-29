class AvailableGroup {
  constructor(groupID, groupName, lastMessage) {
    this.groupID = groupID;
    this.groupName = groupName;
    this.lastMessage = lastMessage;
  }
}

try {
  if (module) module.exports = AvailableGroup; // Allow class to be accessed by server.
} catch (err) {
  // Do nothing. This was a client-side access to the class.
}
