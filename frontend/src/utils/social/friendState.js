export function getFriendState(userId, friends, incoming, outgoing)
{
    if (friends.some(f => f.id === userId)) 
    {
        return 'friend'
    }
    if (incoming.some(r => r.requester_id === userId))
    {
        return 'incoming'
    }
    if (outgoing.some(r => r.addressee_id === userId))
    {
        return 'outgoing'
    }
    return 'none'
}