export interface User {
  id: string;
  name: string;
  roomId: string;
  workspaceId: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  timestamp: number;
}

export interface Channel {
  id: string;
  workspace_id: string;
  team_id?: string | null;
  name: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  name: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  user_name: string;
  role: string;
}

export interface Workspace {
  id: string;
  name: string;
  channels: Channel[];
  teams: Team[];
  members: WorkspaceMember[];
}

export type SignalData = {
  type: "offer" | "answer" | "candidate";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
};
