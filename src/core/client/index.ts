import { Collections } from "../../../typings/filesystem";


export interface ClientRequestPayload extends Partial<Collections> {
  id: string;
}

export async function send(_param: ClientRequestPayload): Promise<void> {
  // Request logic to be implemented later.
}

export async function stop(_id: string): Promise<void> {
  // Stop logic to be implemented later.
}

export default send;
