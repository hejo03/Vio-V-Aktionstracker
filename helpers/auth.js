const sessionIdToUserId = {}; // hier kann auch ne DB benutzt werden um Sessions zu speichern

/**
 * get UserId from SessionId
 * @param {string} sessionId
 * @return {number}
 */
function getUser(sessionId) {
    return sessionIdToUserId[sessionId];
}

/**
 * set SessionId reference
 * @param {string} sessionId
 * @param {number} userId
 */
function setUser(sessionId, userId) {
    sessionIdToUserId[sessionId] = userId;
}

/**
 * remove SessionId reference
 * @param {string} sessionId
 */
function removeUser(sessionId) {
    delete sessionIdToUserId[sessionId];
}

/**
 * checks if UserId has an active SessionId (is logged in)
 * @param {number} userId
 * @return {boolean}
 */
function isUserActiveByUserId(userId) {
    return Object.values(sessionIdToUserId).includes(userId);
}

/**
 * force User to Logout (e.g. after Password changed)
 * @param {number} userId
 */
function forceLogoutUserByUserId(userId) {
    for (const [sId, _userId] of Object.entries(sessionIdToUserId)) {
        if (_userId === userId) {
            delete sessionIdToUserId[sId];
        }
    }
}

module.exports = {
    getUser,
    setUser,
    removeUser,
    isUserActiveByUserId,
    forceLogoutUserByUserId,
}