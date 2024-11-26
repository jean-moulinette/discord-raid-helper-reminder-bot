export const CRON_SCHEDULE_EVERY_DAYS_AT_6PM = "0 18 * * *";
export const CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT = "5 0 * * *"; //Leave 5 minutes after midnight in case raid-helper gets delayed
export const CRON_SCHEDULE_EVERYTUESDAY_AT_6PM_AND_1_MINUTE = "1 18 * * 2"; // Tuesday at 6pm and 1 minute

export const OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_OF_WEEK = "La récupération des raids helpers a échoué, les serveurs de raid-helper ne répondent pas, merci de ping les raiders manuellement pour les raids de la semaine";
export const OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_IN_TWO_DAYS = "La récupération des raids helpers a échoué, les serveurs de raid-helper ne répondent pas, merci de ping les raiders manuellement pour le raids dans 2 jours";

export const HYDRATING_ACTIVE_RAIDS_ERROR = "Error while hydrating active raid helpers from Raid-Helper"