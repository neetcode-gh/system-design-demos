#!/usr/bin/env node

/**
 * Redis Sorted Set Demo - User Leaderboard (JavaScript)
 * Demonstrates storing (user_id, score) tuples in Redis sorted sets
 */

const redis = require('redis');
const readline = require('readline');
const { spawn, exec } = require('child_process');

class LeaderboardDemo {
    constructor() {
        this.client = null;
        this.leaderboardKey = 'user_leaderboard';
        this.rl = null;
        this.redisProcess = null;
    }

    async checkRedisInstalled() {
        return new Promise((resolve) => {
            exec('which redis-server', (error, stdout, stderr) => {
                resolve(!error && stdout.trim().length > 0);
            });
        });
    }

    async startRedisServer() {
        return new Promise((resolve, reject) => {
            console.log('🚀 Starting Redis server...');
            
            // Try to start Redis server
            this.redisProcess = spawn('redis-server', ['--port', '6379'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let serverReady = false;

            this.redisProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Ready to accept connections') && !serverReady) {
                    serverReady = true;
                    console.log('✅ Redis server started successfully!');
                    resolve();
                }
            });

            this.redisProcess.stderr.on('data', (data) => {
                console.log('Redis stderr:', data.toString());
            });

            this.redisProcess.on('error', (error) => {
                reject(new Error(`Failed to start Redis: ${error.message}`));
            });

            this.redisProcess.on('exit', (code) => {
                if (code !== 0 && !serverReady) {
                    reject(new Error(`Redis server exited with code ${code}`));
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!serverReady) {
                    reject(new Error('Redis server failed to start within 10 seconds'));
                }
            }, 10000);
        });
    }

    async connectRedis() {
        try {
            this.client = redis.createClient({
                host: 'localhost',
                port: 6379,
                db: 0
            });

            this.client.on('error', (err) => {
                console.log('❌ Redis Client Error:', err);
            });

            await this.client.connect();
            await this.client.ping();
            console.log('✅ Connected to Redis successfully!');
            return true;
        } catch (error) {
            console.log('❌ Could not connect to Redis:', error.message);
            console.log('   Please make sure Redis is running: sudo service redis-server start');
            return false;
        }
    }

    async addUserScore(userId, score) {
        await this.client.zIncrBy(this.leaderboardKey, score, userId);
        console.log(`✅ Added: ${userId} -> ${score}`);
    }

    async clearLeaderboard() {
        await this.client.del(this.leaderboardKey);
        console.log('🗑️  Leaderboard cleared');
    }

    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async getCurrentLeaderboard() {
        const totalUsers = await this.client.zCard(this.leaderboardKey);
        
        if (totalUsers === 0) {
            console.log('\n📊 Leaderboard is empty');
            return;
        }

        console.log('\n🏆 Current Leaderboard (Sorted by Score):');
        console.log('='.repeat(45));
        
        // Get all users with scores (ZREVRANGE for descending order)
        const allUsers = await this.client.zRangeWithScores(this.leaderboardKey, 0, -1);
        allUsers.reverse();
        allUsers.forEach((user, index) => {
            const rank = index + 1;
            console.log(`   ${rank.toString().padStart(2)}. ${user.value.padEnd(15)} - ${Number(user.score).toLocaleString()} points`);
        });
        
        console.log('='.repeat(45));
        console.log(`Total users: ${totalUsers}`);
    }

    parseInput(input) {
        const trimmed = input.trim();
        
        // Handle special commands
        if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'exit') {
            return { command: 'quit' };
        }
        
        if (trimmed.toLowerCase() === 'clear') {
            return { command: 'clear' };
        }
        
        if (trimmed.toLowerCase() === 'help') {
            return { command: 'help' };
        }

        // Parse user_id,score format
        const parts = trimmed.split(',');
        if (parts.length !== 2) {
            return { error: 'Invalid format. Use: user_id,score (e.g., alice123,1500)' };
        }

        const userId = parts[0].trim();
        const scoreStr = parts[1].trim();
        
        if (!userId) {
            return { error: 'User ID cannot be empty' };
        }

        const score = parseFloat(scoreStr);
        if (isNaN(score)) {
            return { error: 'Score must be a valid number' };
        }

        return { userId, score };
    }

    showHelp() {
        console.log('\n📖 Help:');
        console.log('  Enter tuples in format: user_id,score');
        console.log('  Examples:');
        console.log('    alice123,1500');
        console.log('    bob_gamer,2750');
        console.log('    charlie99,980');
        console.log('\n  Press Ctrl+C to exit');
        console.log('');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');
        
        if (this.rl) {
            this.rl.close();
        }
        
        if (this.client) {
            try {
                await this.client.disconnect();
                console.log('🔌 Disconnected from Redis client');
            } catch (error) {
                console.log('Error disconnecting Redis client:', error.message);
            }
        }
        
        if (this.redisProcess) {
            console.log('🛑 Stopping Redis server...');
            this.redisProcess.kill('SIGTERM');
            
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!this.redisProcess.killed) {
                this.redisProcess.kill('SIGKILL');
            }
            console.log('✅ Redis server stopped');
        }
        
        console.log('👋 Goodbye!');
        process.exit(0);
    }

    async startInteractiveMode() {
        console.log('🎮 Interactive Redis Sorted Set Demo');
        console.log('='.repeat(40));
        console.log('Enter user scores and see the live leaderboard!');
        this.showHelp();

        const askForInput = () => {
            this.rl.question('Enter user_id,score: ', async (input) => {
                try {
                    console.log(`Debug: Processing input: "${input}"`);
                    const parsed = this.parseInput(input);
                    console.log('Debug: Parsed result:', parsed);
                    
                    if (parsed.error) {
                        console.log(`❌ ${parsed.error}`);
                        askForInput();
                        return;
                    }
                    
                    if (parsed.command) {
                        console.log(`❌ Commands not supported in this version. Just enter user_id,score`);
                        askForInput();
                        return;
                    }
                    
                    // Add the user score
                    console.log(`Debug: Adding score for ${parsed.userId}: ${parsed.score}`);
                    await this.addUserScore(parsed.userId, parsed.score);
                    
                    // Show updated leaderboard
                    console.log('Debug: Displaying leaderboard...');
                    await this.getCurrentLeaderboard();
                    
                    askForInput();
                    
                } catch (error) {
                    console.error('❌ Error:', error.message);
                    console.error('❌ Stack:', error.stack);
                    askForInput();
                }
            });
        };

        askForInput();
    }

    setupProcessHandlers() {
        // Handle Ctrl+C gracefully
        process.on('SIGINT', async () => {
            await this.cleanup();
        });

        // Handle other termination signals
        process.on('SIGTERM', async () => {
            await this.cleanup();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('❌ Uncaught Exception:', error);
            await this.cleanup();
        });
    }

    async runDemo() {
        console.log('🎮 Redis Sorted Set Demo - Interactive User Leaderboard');
        console.log('='.repeat(55));
        
        // Setup process handlers for graceful shutdown
        this.setupProcessHandlers();
        
        // Connect to Redis (will auto-start if needed)
        const connected = await this.connectRedis();
        if (!connected) {
            return;
        }

        // Setup readline
        this.setupReadline();

        try {
            // Clear any existing data for fresh start
            await this.clearLeaderboard();
            
            // Show initial empty leaderboard
            await this.getCurrentLeaderboard();
            
            // Start interactive mode
            await this.startInteractiveMode();
            
        } catch (error) {
            console.error('❌ Error during demo:', error);
            await this.cleanup();
        }
    }
}


// Run the demo
if (require.main === module) {
    const demo = new LeaderboardDemo();
    demo.runDemo().catch(console.error);
}
