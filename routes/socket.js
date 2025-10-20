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
        console.log('Client connected to server socket, ID:', socket.id);
        
        socket.on('disconnect', () => {
            console.log('Client disconnected from server socket, ID:', socket.id);
        });
    });

    formbarSocket.on('connect', () => {
        console.log('Connected to Formbar socket');

        if (cachedRawToken) {
            console.log('Sending auth token to Formbar');
            formbarSocket.emit('auth', { token: cachedRawToken });
            
            // Request the active classroom data using the correct events
            setTimeout(() => {
                console.log('Requesting active classroom from Formbar');
                formbarSocket.emit('getActiveClass');
                // Also request classroom update
                formbarSocket.emit('classUpdate');
            }, 1000);
        } else {
            console.log('No cached token available for Formbar authentication');
        }
    });
    
    // Listen for ALL events from Formbar to debug what's being sent
    formbarSocket.onAny((eventName, ...args) => {
        console.log(`Received Formbar event: ${eventName}`, args);
        
        // Relay all events to clients for debugging
        io.emit('formbarDebug', { eventName, data: args });
    });
    
    // Listen for authentication response
    formbarSocket.on('authenticated', (data) => {
        console.log('Formbar authentication successful:', data);
    });
    
    formbarSocket.on('authError', (error) => {
        console.error('Formbar authentication error:', error);
    });
    
    // Listen for the classroom/class being set
    formbarSocket.on('setClass', (classId) => {
        console.log('Received setClass from Formbar. Class ID:', classId);
        
        // When we get a class ID, request the full classroom data
        formbarSocket.emit('classUpdate');
    });
    
    // Listen for classroom data updates (this is the main event)
    formbarSocket.on('classUpdate', (classroomData) => {
        console.log('Received classUpdate from Formbar:', classroomData);
        
        // Store the current classroom state
        currentClassroom = classroomData;
        
        // Relay the classroom data to all connected clients
        console.log('Emitting classUpdate to all connected clients');
        io.emit('classUpdate', classroomData);
    });
    
    // Poll for classroom updates every 10 seconds
    setInterval(() => {
        if (formbarSocket.connected && cachedRawToken) {
            console.log('Polling for classroom updates...');
            formbarSocket.emit('classUpdate');
        }
    }, 10000);

    formbarSocket.on('event', (data) => {
        console.log('Received event from Formbar:', data);
        io.emit('formbarEvent', data);
    });

    formbarSocket.on('connect_error', (err) => {
        console.error('Formbar connection error:', err);
    });
    
    formbarSocket.on('disconnect', () => {
        console.log('Disconnected from Formbar socket');
    });
}

function checkPermissions(io, formbarSocket) {

}

// Function to get current classroom data
function getCurrentClassroom() {
    return currentClassroom;
}

module.exports = { setupFormbarSocket, setRawToken, getCurrentClassroom };