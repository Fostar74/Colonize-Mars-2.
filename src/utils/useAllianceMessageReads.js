import {useNotificationReads} from "./useNotificationReads";

export default function useAllianceMessageReads(api,userId,unreadIds){
  return useNotificationReads(api,userId,unreadIds,"colonize-mars-pending-alliance-message-reads:"+userId,
    "/alliance/messages/"+encodeURIComponent(userId)+"/read");
}
