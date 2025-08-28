// Chat Interface JavaScript
class AgenticRAGChat {
    constructor() {
        this.currentAgent = 'custom';
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateAgentIndicator();
        this.autoResizeTextarea();
    }

    setupEventListeners() {
        // Agent toggle
        document.querySelectorAll('input[name="agent"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentAgent = e.target.value;
                this.updateAgentIndicator();
            });
        });

        // Message input
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        messageInput.addEventListener('input', this.autoResizeTextarea);

        // Send button
        document.getElementById('sendButton').addEventListener('click', () => {
            this.sendMessage();
        });
    }

    updateAgentIndicator() {
        const indicator = document.getElementById('agentIndicator');
        const agentNames = {
            'custom': 'Custom Workflow Agent',
            'react': 'React Agent'
        };
        indicator.textContent = `Using ${agentNames[this.currentAgent]}`;
    }

    autoResizeTextarea() {
        const textarea = document.getElementById('messageInput');
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    setQuery(query) {
        document.getElementById('messageInput').value = query;
        this.autoResizeTextarea();
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || this.isLoading) return;

        // Clear input
        messageInput.value = '';
        this.autoResizeTextarea();

        // Add user message to chat
        this.addMessage(message, 'user');

        // Set loading state
        this.setLoading(true);
        const loadingMessage = this.addLoadingMessage();

        try {
            // Send request to appropriate agent
            const response = await this.callAgent(message);
            
            // Remove loading message
            this.removeMessage(loadingMessage);
            
            // Add agent response
            this.addMessage(response.answer, 'assistant', response.explainability, response.metadata);
            
        } catch (error) {
            console.error('Error:', error);
            this.removeMessage(loadingMessage);
            this.addMessage('Sorry, I encountered an error while processing your request. Please try again.', 'assistant', null, null, true);
        } finally {
            this.setLoading(false);
        }
    }

    async callAgent(message) {
        const endpoints = {
            'custom': '/api/workflow/query',
            'react': '/api/react/query'
        };

        const response = await fetch(endpoints[this.currentAgent], {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: message })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    addMessage(content, type, explainability = null, metadata = null, isError = false) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        const avatar = type === 'user' ? '👤' : (isError ? '❌' : '🤖');
        
        // Add copy button for long responses
        const isLongContent = content.length > 500;
        const copyButton = isLongContent && type === 'assistant' ? 
            `<button class="copy-button" onclick="copyToClipboard('${this.escapeForAttribute(content)}')">📋 Copy</button>` : '';

        let executionDetails = '';
        if (explainability && metadata) {
            const { decisionPoints, executionSteps, retrievalDetails, rejectionReason } = explainability;
            const { executionTimeMs, agentType } = metadata;

            executionDetails = `
                <div class="execution-details">
                    <h4>Execution Summary</h4>
                    <p><strong>Agent:</strong> ${agentType || this.currentAgent}</p>
                    <p><strong>Execution Time:</strong> ${(executionTimeMs / 1000).toFixed(2)}s</p>
                    <p><strong>RAG Used:</strong> ${decisionPoints.needsRAG ? 'Yes' : 'No'}</p>
                    ${decisionPoints.needsRAG ? `<p><strong>Documents:</strong> ${decisionPoints.ragAccepted ? 'Accepted ✅' : 'Discarded ❌'}</p>` : ''}
                    ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
                    
                    ${executionSteps && executionSteps.length > 0 ? `
                        <h4>Execution Steps</h4>
                        <ul class="execution-steps">
                            ${executionSteps.map(step => `<li>${step.step}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                ${copyButton}
                <div class="message-text">${this.formatMessage(content)}</div>
                ${executionDetails}
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageDiv;
    }

    addLoadingMessage() {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';

        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-text loading-message">
                    <span>Thinking</span>
                    <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageDiv;
    }

    removeMessage(messageElement) {
        if (messageElement && messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }

    formatMessage(content) {
        // Enhanced formatting for structured documents like PRDs
        let formatted = content
            // Handle headers (# ## ### ####)
            .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            
            // Handle bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            
            // Handle italic text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Handle lists (- or *)
            .replace(/^[\-\*] (.*$)/gm, '<li>$1</li>')
            
            // Handle numbered lists
            .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
            
            // Handle code blocks or sections with ---
            .replace(/^---$/gm, '<hr>')
            
            // Handle double line breaks as paragraph breaks
            .replace(/\n\n/g, '</p><p>')
            
            // Handle single line breaks
            .replace(/\n/g, '<br>')
            
            // Wrap in paragraphs
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
        
        // Clean up and wrap lists properly
        formatted = formatted
            .replace(/(<li>.*?<\/li>)/g, (match, p1) => {
                return p1;
            })
            .replace(/(<p>)?(<li>)/g, '<ul>$2')
            .replace(/(<\/li>)(<\/p>)?/g, '$1</ul>')
            .replace(/<\/ul>(\s*<br>\s*)<ul>/g, '')
            .replace(/<p><ul>/g, '<ul>')
            .replace(/<\/ul><\/p>/g, '</ul>');
        
        // Clean up empty paragraphs and fix formatting
        formatted = formatted
            .replace(/<p><\/p>/g, '')
            .replace(/<p><br><\/p>/g, '')
            .replace(/<p><h([1-6])>/g, '<h$1>')
            .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
            .replace(/<p><hr><\/p>/g, '<hr>')
            .replace(/<br><h([1-6])>/g, '<h$1>')
            .replace(/<\/h([1-6])><br>/g, '</h$1>');
        
        return formatted;
    }

    escapeForAttribute(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }

    setLoading(loading) {
        this.isLoading = loading;
        const sendButton = document.getElementById('sendButton');
        const statusIndicator = document.getElementById('statusIndicator');
        
        sendButton.disabled = loading;
        
        if (loading) {
            statusIndicator.innerHTML = `
                <div class="status-dot"></div>
                <span>Processing...</span>
            `;
            statusIndicator.className = 'status-indicator loading';
        } else {
            statusIndicator.innerHTML = `
                <div class="status-dot"></div>
                <span>Ready</span>
            `;
            statusIndicator.className = 'status-indicator';
        }
    }
}

// Global functions for example buttons
function setQuery(query) {
    chat.setQuery(query);
}

// Global function for copying content
function copyToClipboard(text) {
    // Unescape the text
    const unescapedText = text.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
    
    navigator.clipboard.writeText(unescapedText).then(() => {
        // Show a temporary success message
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.background = '#48bb78';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = unescapedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    });
}

// Initialize chat when DOM is loaded
let chat;
document.addEventListener('DOMContentLoaded', () => {
    chat = new AgenticRAGChat();
});

// Auto-resize textarea function (accessible globally)
function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}
