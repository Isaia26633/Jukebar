const express = require('express');
const { formbarSocket } = require('../app');
const router = express.Router();

// Relay Formbar events to connected clients
function setupFormbarSocket(io, formbarSocket) {
    formbarSocket.on('connect', () => {
        console.log('Connected to Formbar socket');
    });
    formbarSocket.on('classUpdate', (classroomData) => {
        console.log('Received classroom update from Formbar:', classroomData);
        // Relay the classroom data to all connected clients
        io.emit('classroomUpdate', classroomData);
    });

    formbarSocket.on('event', (data) => {
        console.log('Received event from Formbar:', data);
        io.emit('formbarEvent', data);
    });

    formbarSocket.on('connect_error', (err) => {
        console.error('Formbar connection error:', err);
    });
}

function checkPermissions(io, formbarSocket) {

}
module.exports = { router, setupFormbarSocket };