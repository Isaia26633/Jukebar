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
            console.log('Authenticating with Formbar using user token');
            formbarSocket.emit('auth', { token: cachedRawToken });
            
            setTimeout(() => {
                console.log('Requesting active class data');
                formbarSocket.emit('getActiveClass');
            }, 1000);
        } else {
            console.log('No user token available - waiting for user to log in');
        }
    });
    
    // Listen for ALL events from Formbar to debug what's being sent
    formbarSocket.onAny((eventName, ...args) => {
        console.log(`[Formbar Event] ${eventName}:`, JSON.stringify(args, null, 2));
        // Relay all events to clients for debugging
        io.emit('formbarDebug', { eventName, data: args });
    });
    
    // Listen for authentication response
    formbarSocket.on('authenticated', (data) => {
        console.log('Formbar authentication successful:', data);
        // After authentication, request class data
        setTimeout(() => {
            console.log('Requesting classUpdate after authentication');
            formbarSocket.emit('classUpdate');
        }, 500);
    });
    
    formbarSocket.on('authError', (error) => {
        console.error('Formbar authentication error:', error);
    });
    
    // Listen for the classroom/class being set
    formbarSocket.on('setClass', (classId) => {
        console.log('Received setClass event. Class ID:', classId);
        // When we get a class ID, request the full classroom data
        formbarSocket.emit('classUpdate');
    });
    
    // Listen for classroom data updates (this is the main event)
    formbarSocket.on('classUpdate', (classroomData) => {
        console.log('\n=== Received classUpdate from Formbar ===');
        console.log('Full classroom data:', JSON.stringify(classroomData, null, 2));
        
        // Extract auxiliary permission (the classroom's permission level)
        const auxiliaryPermission = Number(classroomData.permissions.auxiliary);
        console.log('\nClassroom auxiliary permission:', auxiliaryPermission);
        
        // Log all students and their permissions
        if (classroomData.students) {
            console.log('\nStudents in classroom:');
            Object.keys(classroomData.students).forEach(username => {
                const student = classroomData.students[username];
                console.log(`  - ${username}: classPermissions = ${student.classPermissions}`);
            });
        }
        console.log('========================================\n');
        
        // Store the current classroom state
        currentClassroom = classroomData;
        
        // Send both permissions to all connected clients
        io.emit('auxiliaryPermission', auxiliaryPermission);
        
        // Send the full classroom data so clients can get their own permission
        io.emit('classUpdate', classroomData);
    });
    
    // Poll for classroom updates every 3 seconds
    setInterval(() => {
        if (formbarSocket.connected && cachedRawToken) {
            formbarSocket.emit('classUpdate');
        }
    }, 3000);

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