// Message class to store the chat message and metadata.

class Message {
  constructor(groupID, authorID, messageID, messageString, timestamp) {
    this.groupID = groupID;
    this.authorID = authorID;
    this.messageID = messageID;
    this.messageString = messageString;
    this.timestamp = timestamp;
  }
}
