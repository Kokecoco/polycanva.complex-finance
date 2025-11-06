// ゲーム状態管理
class TradingGame {
    constructor() {
        this.currentPrice = 0;
        this.previousPrice = 0;
        this.cashBalance = 1000000; // 初期資金 100万円
        this.shares = 0;
        this.transactionHistory = [];
        this.lastUpdate = null;
        
        // ローカルストレージから状態を読み込み
        this.loadState();
        
        // UI要素の参照
        this.initializeElements();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // 価格データの取得開始
        this.fetchPrice();
        
        // 1分ごとに価格を更新
        setInterval(() => this.fetchPrice(), 60000);
        
        // UI更新
        this.updateUI();
    }
    
    initializeElements() {
        this.elements = {
            currentPrice: document.getElementById('currentPrice'),
            priceChange: document.getElementById('priceChange'),
            lastUpdate: document.getElementById('lastUpdate'),
            cashBalance: document.getElementById('cashBalance'),
            shares: document.getElementById('shares'),
            portfolioValue: document.getElementById('portfolioValue'),
            totalAssets: document.getElementById('totalAssets'),
            tradeAmount: document.getElementById('tradeAmount'),
            tradePreview: document.getElementById('tradePreview'),
            historyList: document.getElementById('historyList'),
            buyBtn: document.getElementById('buyBtn'),
            sellBtn: document.getElementById('sellBtn'),
            refreshBtn: document.getElementById('refreshBtn'),
            resetBtn: document.getElementById('resetBtn')
        };
    }
    
    setupEventListeners() {
        this.elements.buyBtn.addEventListener('click', () => this.buy());
        this.elements.sellBtn.addEventListener('click', () => this.sell());
        this.elements.refreshBtn.addEventListener('click', () => this.fetchPrice());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        this.elements.tradeAmount.addEventListener('input', () => this.updateTradePreview());
    }
    
    async fetchPrice() {
        try {
            this.elements.lastUpdate.textContent = 'データ取得中...';
            this.elements.lastUpdate.classList.add('loading');
            
            // Yahoo Finance APIの代替として、複数のソースを試す
            // まずは Alpha Vantage を試す（無料枠あり）
            // APIキー不要の公開データソースとしてYahoo Finance v8を使用
            const symbol = '^N225'; // 日経225のシンボル
            
            // オプション1: Yahoo Finance API (非公式だが動作する)
            let price = await this.fetchFromYahoo(symbol);
            
            // オプション2: フォールバック - 模擬データ
            if (!price) {
                price = await this.fetchMockData();
            }
            
            this.previousPrice = this.currentPrice || price;
            this.currentPrice = price;
            this.lastUpdate = new Date();
            
            this.updateUI();
            this.saveState();
            
        } catch (error) {
            console.error('価格取得エラー:', error);
            this.elements.lastUpdate.textContent = 'データ取得失敗 - 再試行中...';
            
            // エラー時は模擬データを使用
            if (this.currentPrice === 0) {
                this.currentPrice = 38000 + Math.random() * 2000; // 38000-40000の範囲
                this.previousPrice = this.currentPrice;
                this.updateUI();
            }
        } finally {
            this.elements.lastUpdate.classList.remove('loading');
        }
    }
    
    async fetchFromYahoo(symbol) {
        try {
            // Yahoo Finance query APIを使用
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Yahoo Finance API error');
            }
            
            const data = await response.json();
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const quote = result.meta.regularMarketPrice || 
                             result.indicators.quote[0].close.slice(-1)[0];
                
                if (quote && !isNaN(quote)) {
                    return Math.round(quote * 100) / 100;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Yahoo Finance fetch error:', error);
            return null;
        }
    }
    
    async fetchMockData() {
        // 模擬データ: 実際の日経225の範囲内でランダムな価格変動を生成
        const basePrice = this.currentPrice || 38000;
        const change = (Math.random() - 0.5) * 500; // -250から+250の変動
        const newPrice = basePrice + change;
        
        // 現実的な範囲内に制限
        return Math.max(30000, Math.min(45000, Math.round(newPrice * 100) / 100));
    }
    
    updateUI() {
        // 価格表示
        if (this.currentPrice > 0) {
            this.elements.currentPrice.textContent = this.formatNumber(this.currentPrice);
            this.elements.currentPrice.classList.add('price-updated');
            setTimeout(() => {
                this.elements.currentPrice.classList.remove('price-updated');
            }, 500);
        }
        
        // 価格変動の表示
        const change = this.currentPrice - this.previousPrice;
        const changePercent = this.previousPrice > 0 
            ? ((change / this.previousPrice) * 100).toFixed(2)
            : 0;
        
        this.elements.priceChange.innerHTML = `
            <span class="change-value">${change >= 0 ? '+' : ''}${this.formatNumber(change)}</span>
            <span class="change-percent">(${change >= 0 ? '+' : ''}${changePercent}%)</span>
        `;
        
        this.elements.priceChange.className = 'price-change';
        if (change > 0) {
            this.elements.priceChange.classList.add('positive');
        } else if (change < 0) {
            this.elements.priceChange.classList.add('negative');
        } else {
            this.elements.priceChange.classList.add('neutral');
        }
        
        // 最終更新時刻
        if (this.lastUpdate) {
            this.elements.lastUpdate.textContent = 
                `最終更新: ${this.lastUpdate.toLocaleString('ja-JP')}`;
        }
        
        // ユーザー資産
        this.elements.cashBalance.textContent = this.formatNumber(this.cashBalance);
        this.elements.shares.textContent = this.formatNumber(this.shares);
        
        const portfolioValue = this.shares * this.currentPrice;
        this.elements.portfolioValue.textContent = this.formatNumber(Math.round(portfolioValue));
        
        const totalAssets = this.cashBalance + portfolioValue;
        this.elements.totalAssets.textContent = this.formatNumber(Math.round(totalAssets));
        
        // 取引プレビュー
        this.updateTradePreview();
        
        // 取引履歴
        this.updateHistoryDisplay();
    }
    
    updateTradePreview() {
        const amount = parseInt(this.elements.tradeAmount.value) || 0;
        
        if (amount <= 0 || this.currentPrice === 0) {
            this.elements.tradePreview.textContent = '株数を入力してください';
            return;
        }
        
        const cost = amount * this.currentPrice;
        const buyText = `買い: ${this.formatNumber(amount)}株 = ${this.formatNumber(Math.round(cost))}円`;
        const sellText = `売り: ${this.formatNumber(amount)}株 = ${this.formatNumber(Math.round(cost))}円`;
        
        this.elements.tradePreview.textContent = `${buyText} | ${sellText}`;
    }
    
    buy() {
        const amount = parseInt(this.elements.tradeAmount.value) || 0;
        
        if (amount <= 0) {
            alert('株数を入力してください');
            return;
        }
        
        if (this.currentPrice === 0) {
            alert('価格データを取得中です。しばらくお待ちください。');
            return;
        }
        
        const cost = amount * this.currentPrice;
        
        if (cost > this.cashBalance) {
            alert(`資金が不足しています。必要: ${this.formatNumber(Math.round(cost))}円`);
            return;
        }
        
        this.cashBalance -= cost;
        this.shares += amount;
        
        this.addTransaction('buy', amount, this.currentPrice);
        this.saveState();
        this.updateUI();
        
        // 成功フィードバック
        this.showNotification(`✅ ${amount}株を購入しました！`, 'success');
    }
    
    sell() {
        const amount = parseInt(this.elements.tradeAmount.value) || 0;
        
        if (amount <= 0) {
            alert('株数を入力してください');
            return;
        }
        
        if (this.currentPrice === 0) {
            alert('価格データを取得中です。しばらくお待ちください。');
            return;
        }
        
        if (amount > this.shares) {
            alert(`保有株数が不足しています。保有: ${this.shares}株`);
            return;
        }
        
        const revenue = amount * this.currentPrice;
        
        this.cashBalance += revenue;
        this.shares -= amount;
        
        this.addTransaction('sell', amount, this.currentPrice);
        this.saveState();
        this.updateUI();
        
        // 成功フィードバック
        this.showNotification(`✅ ${amount}株を売却しました！`, 'success');
    }
    
    addTransaction(type, amount, price) {
        this.transactionHistory.unshift({
            type,
            amount,
            price,
            total: amount * price,
            timestamp: new Date()
        });
        
        // 最新50件まで保持
        if (this.transactionHistory.length > 50) {
            this.transactionHistory = this.transactionHistory.slice(0, 50);
        }
    }
    
    updateHistoryDisplay() {
        if (this.transactionHistory.length === 0) {
            this.elements.historyList.innerHTML = 
                '<p class="no-history">取引履歴はまだありません</p>';
            return;
        }
        
        const historyHTML = this.transactionHistory.map(tx => {
            const typeText = tx.type === 'buy' ? '買い' : '売り';
            const typeEmoji = tx.type === 'buy' ? '💵' : '💰';
            
            return `
                <div class="history-item ${tx.type}">
                    <span class="type">${typeEmoji} ${typeText}</span>
                    <div class="details">
                        <div>${this.formatNumber(tx.amount)}株 @ ${this.formatNumber(tx.price)}円</div>
                        <div><strong>合計: ${this.formatNumber(Math.round(tx.total))}円</strong></div>
                    </div>
                    <div class="time">${tx.timestamp.toLocaleString('ja-JP')}</div>
                </div>
            `;
        }).join('');
        
        this.elements.historyList.innerHTML = historyHTML;
    }
    
    reset() {
        if (!confirm('本当にゲームをリセットしますか？すべてのデータが削除されます。')) {
            return;
        }
        
        this.cashBalance = 1000000;
        this.shares = 0;
        this.transactionHistory = [];
        
        this.saveState();
        this.updateUI();
        
        this.showNotification('🔄 ゲームをリセットしました', 'info');
    }
    
    showNotification(message, type) {
        // 簡易通知システム
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#28a745' : '#667eea'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    formatNumber(num) {
        return num.toLocaleString('ja-JP', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
    
    saveState() {
        const state = {
            cashBalance: this.cashBalance,
            shares: this.shares,
            transactionHistory: this.transactionHistory,
            currentPrice: this.currentPrice,
            previousPrice: this.previousPrice,
            lastUpdate: this.lastUpdate
        };
        
        localStorage.setItem('tradingGameState', JSON.stringify(state));
    }
    
    loadState() {
        const saved = localStorage.getItem('tradingGameState');
        
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.cashBalance = state.cashBalance || 1000000;
                this.shares = state.shares || 0;
                this.transactionHistory = state.transactionHistory || [];
                this.currentPrice = state.currentPrice || 0;
                this.previousPrice = state.previousPrice || 0;
                
                if (state.lastUpdate) {
                    this.lastUpdate = new Date(state.lastUpdate);
                }
                
                // 日付オブジェクトを復元
                this.transactionHistory = this.transactionHistory.map(tx => ({
                    ...tx,
                    timestamp: new Date(tx.timestamp)
                }));
            } catch (error) {
                console.error('状態の読み込みエラー:', error);
            }
        }
    }
}

// アニメーション用CSS追加
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ゲーム初期化
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TradingGame();
});
