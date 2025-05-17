const net = require('net');
const { exec } = require('child_process');
const os = require('os');

const PORT = 3000;
const HOST = '0.0.0.0';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const privatecommands = [
  'ip',
  'ipconfig',
  'ifconfig',
  'hostname',
  'whoami',
  'netstat',
  'arp',
  'route',
  'getmac',
  'uname',
  'env',
  'set',
  'systeminfo',
  'tasklist',
  'ps',
  'net user',
  'net localgroup administrators',
  'who',
  'last',
  'finger',
  'uptime',
  'tree',
];

const dangerousCommands = [
  'curl',
  'wget',
  'powershell',
  'Invoke-WebRequest',
  'Invoke-Expression',
  'certutil',
  'ftp',
  'nc',
  'netcat',
  'bash',
  'sh',
  'python',
  'perl',
  'ruby',
  'mshta',
  'bitsadmin',
  'ftpget',
  'Invoke-Command',
  'curl -O',
  'rm -rf /',
  'del /f /s /q',
];

const blacklisted = [];

const server = net.createServer((socket) => {
    const clientIP = socket.remoteAddress;
    console.log('Client connected | IP:', clientIP);

    if (blacklisted.includes(clientIP)) {
        socket.write('You are blacklisted (IP) and cannot connect.\n');
        socket.end();
        return;
    }

    socket.write(`Connected to WebShell\n`);
    socket.write(`Type 'exit' to disconnect\n\n`);
    socket.write(`$ `);

    socket.on('data', async (data) => {
        const input = data.toString().trim();

        if (input === 'exit') {
            socket.write('Disconnecting...\n');
            socket.end();
            return;
        }

        console.log(`Client IP: ${clientIP} | Command: ${input}`)
        await executeCommand(input, socket);
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });
});

async function executeCommand(cmd, socket) {
    socket.write('\n');
    await delay(100);

    if (cmd.startsWith("$cmd")) {
        socket.write("You need to be server-sided\n$ ");
        return;
    }

    if (dangerousCommands.some(dc => cmd.startsWith(dc))) {
        socket.write("Error: This command is blocked.\n$ ");
        return;
    }

    if (privatecommands.some(pc => cmd.startsWith(pc))) {
        socket.write("Warning: This is a private command that runs locally on your computer.\n");
        await delay(1000);
        socket.write(`$cmd ${cmd}`);
        return;
    }

    exec(cmd, { env: { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } }, (error, stdout, stderr) => {
        if (error) {
            socket.write(`Error: Command not found or failed to execute\n`);
        }
        if (stderr) {
            socket.write(`${stderr}\n`);
        }
        if (stdout) {
            socket.write(`${stdout}\n`);
        }
        socket.write(`$ `);
    });
}

server.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});
