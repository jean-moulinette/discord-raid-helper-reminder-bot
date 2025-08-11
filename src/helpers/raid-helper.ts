import axios from 'axios';
import { retryOnceAfterDelay } from './async';
import type { PostedRaidHelperEvent, RhEventResponse } from './raid-helper.types';

export async function fetchRaidHelperEventSignUps(
  rhEventId: string,
  onFetchRaidHelperEventSignUpsRetry?: () => void,
) {
  try {
    const response = await retryOnceAfterDelay(
      async () =>
        axios.get<RhEventResponse>(`https://raid-helper.dev/api/v2/events/${rhEventId}`, {
          headers: {
            Authorization: `${process.env.RAID_HELPER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }),
      {
        onRetry: (e) => {
          onFetchRaidHelperEventSignUpsRetry?.();
          console.error(`Fetching event data from Raid-Helper ID: [${rhEventId}] failed. ${e}`);
        },
      },
    );

    return response.data.signUps;
  } catch (error) {
    if (error instanceof Error) {
      throw Error(`Error fetching event data from Raid-Helper ${error.message}`);
    }
    throw Error('Error fetching event data from Raid-Helper');
  }
}

type RhEventsResponse = {
  pages: number;
  currentPage: number;
  eventCountOverall: number;
  eventCountTransmitted: number;
  postedEvents: PostedRaidHelperEvent[];
};

export async function fetchRaidHelperPostedEvents(
  onFetchRaidHelpersPostedEventsRetry?: () => void,
) {
  try {
    const response = await retryOnceAfterDelay(
      async () =>
        axios.get<RhEventsResponse>(
          `https://raid-helper.dev/api/v3/servers/${process.env.GUILD_ID}/events`,
          {
            headers: {
              Authorization: `${process.env.RAID_HELPER_API_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      {
        onRetry: (e) => {
          onFetchRaidHelpersPostedEventsRetry?.();
          console.error(`Fetching all posted events from Raid-Helper failed. ${e}`);
        },
      },
    );
    return response.data.postedEvents;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching all posted events from Raid-Helper ${e.message}`);
    }
    throw Error('Error fetching all posted events from Raid-Helper');
  }
}

export async function deleteRaidHelperEvent(eventId: string) {
  try {
    const response = await retryOnceAfterDelay(
      async () =>
        axios.delete(`https://raid-helper.dev/api/v2/events/${eventId}`, {
          headers: {
            Authorization: `${process.env.RAID_HELPER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }),
      {
        onRetry: (e) =>
          console.error(`Deleting event from Raid-Helper ID: [${eventId}] failed. ${e}`),
      },
    );

    return response.status;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error deleting event from Raid-Helper ${e.message}`);
    }
    throw Error('Error deleting event from Raid-Helper');
  }
}

export async function createRaidHelperEvent(channelId: string, date: string, title?: string) {
  try {
    const response = await retryOnceAfterDelay(
      async () =>
        axios.post(
          `https://raid-helper.dev/api/v2/servers/${process.env.GUILD_ID}/channels/${channelId}/event`,
          {
            leaderId: process.env.RAID_LEAD_USER_ID,
            templateId: process.env.RAID_HELPER_TEMPLATE_ID,
            title,
            advancedSettings: {
              vacuum: true,
              tentative_emote: 'remove',
              bench_emote: 'remove',
            },
            date,
          },
          {
            headers: {
              Authorization: `${process.env.RAID_HELPER_API_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      {
        onRetry: (e) => console.error(`Creating event in Raid-Helper failed. ${e}`),
      },
    );

    return response.status;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error creating event in Raid-Helper ${e.message}`);
    }

    throw Error('Error creating event in Raid-Helper');
  }
}
