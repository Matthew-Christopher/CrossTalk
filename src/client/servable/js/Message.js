// Message class to store the chat message and metadata.

class Message {
  constructor(messageID, groupID, authorID, authorDisplayName, messageString, timestamp) {
    this.MessageID = messageID;
    this.GroupID = groupID;
    this.AuthorID = authorID;
    this.AuthorDisplayName = authorDisplayName;
    this.MessageString = messageString;
    this.Timestamp = timestamp;
  }
}
