// Store the raw token globally (you might want a better approach)
let cachedRawToken = null;

// Store the current classroom state
let currentClassroom = null;


function setRawToken(token) {
    cachedRawToken = token;
}

function setupFormbarSocket(io, formbarSocket) {
    // Track client connections
    io.on('connection', (socket) => {
        socket.on('disconnect', () => {});
    });

    formbarSocket.on('connect', () => {
        console.log('Connected to Formbar socket');

        if (cachedRawToken) {
            formbarSocket.emit('auth', { token: cachedRawToken });
            
            // Request the active classroom data using the correct events
            setTimeout(() => {
                formbarSocket.emit('getActiveClass');
                formbarSocket.emit('classUpdate');
            }, 1000);
        }
    });
    
    // Listen for ALL events from Formbar to debug what's being sent
    formbarSocket.onAny((eventName, ...args) => {
        // Relay all events to clients for debugging
        io.emit('formbarDebug', { eventName, data: args });
    });
    
    // Listen for authentication response
    formbarSocket.on('authenticated', (data) => {
        console.log('Formbar authentication successful');
    });
    
    formbarSocket.on('authError', (error) => {
        console.error('Formbar authentication error:', error);
    });
    
    // Listen for the classroom/class being set
    formbarSocket.on('setClass', (classId) => {
        // When we get a class ID, request the full classroom data
        formbarSocket.emit('classUpdate');
    });
    
    // Listen for classroom data updates (this is the main event)
    formbarSocket.on('classUpdate', (classroomData) => {
        // Extract auxiliary permission
        const auxiliaryPermission = Number(classroomData.permissions.auxiliary);
        // console.log('Auxiliary permission:', auxiliaryPermission);
        
        // Store the current classroom state
        currentClassroom = classroomData;
        
        // Send auxiliary permission to all connected clients
        io.emit('auxiliaryPermission', auxiliaryPermission);
        
        // Relay the full classroom data to all connected clients
        io.emit('classUpdate', classroomData);
    });
    
    // Poll for classroom updates every 10 seconds
    setInterval(() => {
        if (formbarSocket.connected && cachedRawToken) {
            formbarSocket.emit('classUpdate');
        }
    }, 10000);

    formbarSocket.on('event', (data) => {
        io.emit('formbarEvent', data);
    });

    formbarSocket.on('connect_error', (err) => {
        console.error('Formbar connection error:', err);
    });
    
    formbarSocket.on('disconnect', () => {
        console.log('Disconnected from Formbar socket');
    });
}


// Function to get current classroom data
function getCurrentClassroom() {
    return currentClassroom;
}

module.exports = { setupFormbarSocket, setRawToken, getCurrentClassroom };