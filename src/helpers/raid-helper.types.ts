export type PostedRaidHelperEvent = {
  color: string;
  description: string;
  title: string;
  templateId: string;
  signUpCount: string;
  leaderId: string;
  lastUpdated: number;
  leaderName: string;
  closeTime: number;
  startTime: number;
  endTime: number;
  id: string;
  channelId: string;
};

type RhMember = {
  id: number;
  userId: string;
  name: string;
  status: string;
};

export type RhEventResponse = {
  id: string;
  signUps: RhMember[];
};
