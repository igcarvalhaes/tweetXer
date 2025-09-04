// ==UserScript==
// @name         TweetXer Fixed
// @namespace    http://tampermonkey.net/
// @version      0.11.0
// @description  Delete tweets, likes, and DMs from your Twitter account (Fixed for 2024/2025)
// @author       Original: TheCodeTrain, Fixed: Assistant
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // API URLs - updated for 2024/2025
    const API_URLS = {
        deleteTweet: 'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
        deleteTweetAlt: 'https://x.com/i/api/graphql/DeleteTweet/DeleteTweet', // Alternative URL
        unfavorite: 'https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet',
        deleteDM: 'https://x.com/i/api/1.1/dm/conversations/destroy.json',
        deleteConvo: 'https://x.com/i/api/1.1/dm/conversations/destroy.json'
    };

    // Updated CSS selectors
    const SELECTORS = {
        primaryColumn: '[data-testid="primaryColumn"]',
        tweet: '[data-testid="tweet"]',
        caret: '[data-testid="caret"]',
        menuItem: '[role="menuitem"]',
        confirmButton: '[data-testid="confirmationSheetConfirm"]',
        unretweetConfirm: '[data-testid="unretweetConfirm"]',
        unretweet: '[data-testid="unretweet"]',
        unlike: '[data-testid="unlike"]',
        tweetText: '[data-testid="tweetText"]',
        cellInnerDiv: '[data-testid="cellInnerDiv"]',
        timeline: '[aria-label*="Timeline"]',
        userProfile: '[data-testid="UserName"]'
    };

    class TweetXerFixed {
        constructor() {
            this.tIds = [];
            this.fIds = [];
            this.dIds = [];
            this.cIds = [];
            this.index = 0;
            this.running = false;
            this.rateLimited = false;
            this.progressBar = null;
            this.infoDiv = null;
            this.turboMode = false;
        }

        init() {
            console.log('TweetXer Fixed v0.11.0 started');
            this.createUI();
            this.updateTweetCount();
        }

        createUI() {
            // Remove previous UI if it exists
            const existingUI = document.getElementById('tweetxer-ui');
            if (existingUI) existingUI.remove();

            // Create main container
            const container = document.createElement('div');
            container.id = 'tweetxer-ui';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 300px;
                background: #1da1f2;
                color: white;
                padding: 15px;
                border-radius: 10px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;

            // Title
            const title = document.createElement('h3');
            title.textContent = 'TweetXer Fixed v0.11.0';
            title.style.cssText = 'margin: 0 0 10px 0; font-size: 16px;';
            container.appendChild(title);

            // Info div
            this.infoDiv = document.createElement('div');
            this.infoDiv.style.cssText = 'margin-bottom: 10px; font-size: 12px;';
            container.appendChild(this.infoDiv);

            // File upload
            const fileUploadContainer = document.createElement('div');
            fileUploadContainer.style.cssText = 'margin-bottom: 10px;';
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.js';
            fileInput.style.cssText = 'display: none;';
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
            
            const fileButton = document.createElement('button');
            fileButton.textContent = 'Choose File';
            fileButton.style.cssText = `
                width: 70%;
                padding: 5px;
                background: rgba(255,255,255,0.2);
                border: none;
                border-radius: 5px;
                color: white;
                cursor: pointer;
                font-size: 12px;
                margin-right: 5px;
            `;
            fileButton.addEventListener('click', () => fileInput.click());
            
            const fileLabel = document.createElement('span');
            fileLabel.textContent = 'No file selected';
            fileLabel.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.8);';
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    fileLabel.textContent = e.target.files[0].name;
                } else {
                    fileLabel.textContent = 'No file selected';
                }
                this.handleFileUpload(e);
            });
            
            fileUploadContainer.appendChild(fileInput);
            fileUploadContainer.appendChild(fileButton);
            fileUploadContainer.appendChild(document.createElement('br'));
            fileUploadContainer.appendChild(fileLabel);
            container.appendChild(fileUploadContainer);

            // Buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 5px; flex-wrap: wrap;';

            const buttons = [
                { text: 'Delete Normal', action: () => this.slowDelete(false) },
                { text: 'Delete Turbo', action: () => this.slowDelete(true) },
                { text: 'Stop', action: () => this.stop() },
                { text: 'Close', action: () => container.remove() }
            ];

            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                button.style.cssText = `
                    flex: 1;
                    padding: 8px;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    border-radius: 5px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                `;
                button.addEventListener('click', btn.action);
                buttonContainer.appendChild(button);
            });

            container.appendChild(buttonContainer);

            // Progress bar
            this.progressBar = document.createElement('div');
            this.progressBar.style.cssText = `
                width: 100%;
                height: 20px;
                background: rgba(255,255,255,0.2);
                border-radius: 10px;
                margin-top: 10px;
                overflow: hidden;
                display: none;
            `;
            
            const progressFill = document.createElement('div');
            progressFill.style.cssText = `
                height: 100%;
                background: #4CAF50;
                width: 0%;
                transition: width 0.3s;
            `;
            this.progressBar.appendChild(progressFill);
            container.appendChild(this.progressBar);

            document.body.appendChild(container);
        }

        updateTweetCount() {
            const count = this.getTweetCount();
            const retweets = document.querySelectorAll('[data-testid="unretweet"]').length;
            const likes = document.querySelectorAll('[data-testid="unlike"]').length;
            
            this.infoDiv.innerHTML = `
                <div>Tweets/Posts: ${count}</div>
                <div>Retweets: ${retweets}</div>
                <div>Likes: ${likes}</div>
                <div>Status: ${this.running ? 'Running' : 'Stopped'}</div>
                <div>Rate Limited: ${this.rateLimited ? 'Yes' : 'No'}</div>
            `;
        }

        getTweetCount() {
            // Try multiple selectors for counting
            const selectors = [
                '[data-testid="primaryColumn"] h2',
                '[data-testid="UserName"] + div',
                'h2[role="heading"]'
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent;
                    const match = text.match(/(\d+(?:,\d+)*) Tweets?/i);
                    if (match) {
                        return parseInt(match[1].replace(/,/g, ''));
                    }
                }
            }

            // Fallback: count visible tweets on page
            const visibleTweets = document.querySelectorAll(SELECTORS.tweet);
            return visibleTweets.length || 0;
        }

        handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    
                    // Detect file type
                    if (content.includes('window.YTD.tweets.part0')) {
                        console.log('Tweet file detected');
                        this.processTweetFile(content);
                    } else if (content.includes('window.YTD.like.part0')) {
                        console.log('Likes file detected');
                        this.processFavFile(content);
                    } else {
                        console.log('File type not recognized');
                    }
                } catch (error) {
                    console.error('Error processing file:', error);
                }
            };
            reader.readAsText(file);
        }

        processTweetFile(content) {
            try {
                const data = JSON.parse(content.replace('window.YTD.tweets.part0 = ', ''));
                this.tIds = data.map(item => item.tweet.id_str).reverse();
                console.log(`${this.tIds.length} tweets loaded from file`);
                this.updateTweetCount();
            } catch (error) {
                console.error('Error processing tweet file:', error);
            }
        }

        processFavFile(content) {
            try {
                const data = JSON.parse(content.replace('window.YTD.like.part0 = ', ''));
                this.fIds = data.map(item => item.like.tweetId).reverse();
                console.log(`${this.fIds.length} likes loaded from file`);
            } catch (error) {
                console.error('Error processing likes file:', error);
            }
        }

        async testAPI() {
            console.log('Testing API connectivity...');
            
            // Test if we can get necessary tokens
            const csrfToken = this.getCSRFToken();
            const authToken = this.getAuthToken();
            
            console.log('CSRF Token:', csrfToken ? 'OK' : 'ERROR');
            console.log('Auth Token:', authToken ? 'OK' : 'ERROR');
            
            if (!csrfToken || !authToken) {
                alert('Error: Authentication tokens not found. Please log in to X/Twitter.');
                return;
            }

            // Test a simple request
            try {
                const response = await fetch('https://x.com/i/api/1.1/account/verify_credentials.json', {
                    headers: {
                        'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                        'x-csrf-token': csrfToken,
                        'x-twitter-active-user': 'yes'
                    }
                });
                
                if (response.ok) {
                    console.log('API working!');
                    alert('API working correctly!');
                } else {
                    console.log('API error:', response.status);
                    alert(`API error: ${response.status}`);
                }
            } catch (error) {
                console.error('Error testing API:', error);
                alert('Error connecting to API');
            }
        }

        async slowDelete(turboMode = false) {
            if (this.running) {
                console.log('Already running');
                return;
            }

            this.running = true;
            this.turboMode = turboMode;
            this.progressBar.style.display = 'block';
            
            console.log(`Starting ${turboMode ? 'TURBO' : 'normal'} cleanup (tweets, retweets, likes)...`);
            
            let processedCount = 0;
            let retweetCount = 0;
            let likeCount = 0;
            let tweetCount = 0;
            const maxAttempts = 50; // Limit attempts
            
            for (let i = 0; i < maxAttempts && this.running; i++) {
                try {
                    const tweets = document.querySelectorAll(SELECTORS.tweet);
                    
                    if (tweets.length === 0) {
                        console.log('No tweets found on page');
                        break;
                    }

                    const tweet = tweets[0]; // Always get the first tweet
                    const result = await this.deleteTweetElement(tweet);
                    
                    if (result) {
                        processedCount++;
                        // Determine the type of action performed
                        if (tweet.querySelector('[data-testid="unretweet"]')) {
                            retweetCount++;
                            console.log(`Retweet ${retweetCount} cancelled`);
                        } else if (tweet.querySelector('[data-testid="unlike"]')) {
                            likeCount++;
                            console.log(`Like ${likeCount} removed`);
                        } else {
                            tweetCount++;
                            console.log(`Tweet ${tweetCount} deleted`);
                        }
                    }

                    // Update progress bar
                    const progress = (i / maxAttempts) * 100;
                    this.progressBar.firstChild.style.width = `${progress}%`;
                    
                    // Wait before next attempt
                    const baseDelay = this.turboMode ? 200 : 800;
                    const randomDelay = this.turboMode ? 300 : 700;
                    await this.sleep(baseDelay + Math.random() * randomDelay);
                    
                } catch (error) {
                    console.error('Error during deletion:', error);
                    const errorDelay = this.turboMode ? 1000 : 2000;
                    await this.sleep(errorDelay);
                }
            }

            this.running = false;
            this.progressBar.style.display = 'none';
            console.log(`Cleanup completed. ${processedCount} items processed (${tweetCount} tweets, ${retweetCount} retweets, ${likeCount} likes).`);
            this.updateTweetCount();
        }

        async deleteTweetElement(tweetElement) {
            try {
                // Check if it's a retweet first
                const unretweetButton = tweetElement.querySelector('[data-testid="unretweet"]');
                if (unretweetButton) {
                    console.log('Retweet detected - cancelling retweet');
                    unretweetButton.click();
                    const retweetDelay = this.turboMode ? 400 : 800;
                    await this.sleep(retweetDelay);
                    
                    // Procurar pelo menu "Desfazer repost"
                    const menuItems = document.querySelectorAll('[role="menuitem"]');
                    let unretweetMenuItem = null;
                    
                    for (const item of menuItems) {
                        const text = item.textContent.toLowerCase();
                        if (text.includes('undo repost') || text.includes('unretweet') || text.includes('desfazer repost')) {
                            unretweetMenuItem = item;
                            break;
                        }
                    }
                    
                    if (unretweetMenuItem) {
                        unretweetMenuItem.click();
                        const menuDelay = this.turboMode ? 250 : 500;
                        await this.sleep(menuDelay);
                        return true;
                    }
                    
                    // Fallback: look for confirmation button
                    const confirmButton = document.querySelector('[data-testid="unretweetConfirm"]');
                    if (confirmButton) {
                        confirmButton.click();
                        const confirmDelay = this.turboMode ? 250 : 500;
                        await this.sleep(confirmDelay);
                        return true;
                    }
                    
                    return true; // Some retweets don't need confirmation
                }

                // Check if it's a like that can be removed
                const unlikeButton = tweetElement.querySelector('[data-testid="unlike"]');
                if (unlikeButton) {
                    console.log('Like detected - removing like');
                    unlikeButton.click();
                    const likeDelay = this.turboMode ? 150 : 300;
                    await this.sleep(likeDelay);
                    return true;
                }

                // Look for caret menu for own tweets
                const caret = tweetElement.querySelector(SELECTORS.caret);
                if (!caret) {
                    console.log('Menu not found on tweet - may not be your tweet');
                    return false;
                }

                // Click on menu
                caret.click();
                const caretDelay = this.turboMode ? 250 : 500;
                await this.sleep(caretDelay);

                // Look for delete option
                const menuItems = document.querySelectorAll(SELECTORS.menuItem);
                let deleteItem = null;
                
                for (const item of menuItems) {
                    const text = item.textContent.toLowerCase();
                    if (text.includes('delete')) {
                        deleteItem = item;
                        break;
                    }
                }

                if (!deleteItem) {
                    console.log('Delete option not found');
                    // Close menu by clicking outside
                    document.body.click();
                    return false;
                }

                // Click delete
                deleteItem.click();
                const deleteDelay = this.turboMode ? 250 : 500;
                await this.sleep(deleteDelay);

                // Confirm deletion
                const confirmButton = document.querySelector(SELECTORS.confirmButton);
                if (confirmButton) {
                    confirmButton.click();
                    const finalConfirmDelay = this.turboMode ? 250 : 500;
                    await this.sleep(finalConfirmDelay);
                    return true;
                }

                return false;
            } catch (error) {
                console.error('Error deleting tweet:', error);
                return false;
            }
        }

        getCSRFToken() {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'ct0') {
                    return value;
                }
            }
            return null;
        }

        getAuthToken() {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'auth_token') {
                    return value;
                }
            }
            return null;
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        stop() {
            this.running = false;
            console.log('Execution stopped by user');
            this.updateTweetCount();
        }
    }

    // Initialize when page loads
    function initTweetXer() {
        if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
            const tweetXer = new TweetXerFixed();
            tweetXer.init();
            
            // Make globally available for debugging
            window.tweetXerFixed = tweetXer;
        }
    }

    // Wait for page loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTweetXer);
    } else {
        initTweetXer();
    }

})();