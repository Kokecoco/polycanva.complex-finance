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
            
            // APIが成功した場合のみ価格を更新
            if (price && price > 0) {
                this.previousPrice = this.currentPrice || price;
                this.currentPrice = price;
                this.lastUpdate = new Date();
                
                this.updateUI();
                this.saveState();
            } else {
                // API取得失敗時は既存の価格を保持（初回起動時のみデフォルト値を使用）
                if (this.currentPrice === 0) {
                    // 初回起動時のみ、現実的なデフォルト値を設定
                    // 2024-2025年の日経平均の典型的な価格帯を使用
                    this.currentPrice = 39000; // 概算値（実際のAPI取得を優先）
                    this.previousPrice = this.currentPrice;
                }
                this.elements.lastUpdate.textContent = 'API接続失敗 - 前回の価格を表示中';
                this.updateUI();
            }
            
        } catch (error) {
            console.error('価格取得エラー:', error);
            this.elements.lastUpdate.textContent = 'データ取得失敗 - 前回の価格を表示中';
            
            // エラー時も既存の価格を保持（初回起動時のみデフォルト値を使用）
            if (this.currentPrice === 0) {
                // 初回起動時のみ、現実的なデフォルト値を設定
                this.currentPrice = 39000; // 概算値（実際のAPI取得を優先）
                this.previousPrice = this.currentPrice;
            }
            this.updateUI();
        } finally {
            this.elements.lastUpdate.classList.remove('loading');
        }
    }
    
    async fetchUsdJpyRate() {
        try {
            // USD/JPYの為替レートを取得
            const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X');
            
            if (!response.ok) {
                console.error(`USD/JPY API returned status: ${response.status}`);
                return 150; // フォールバック
            }
            
            const data = await response.json();
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                let rate = result.meta.regularMarketPrice;
                
                // regularMarketPriceが無い場合は最新のclose値を使用
                if (!rate && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
                    const quotes = result.indicators.quote[0].close;
                    if (quotes && quotes.length > 0) {
                        rate = quotes[quotes.length - 1];
                    }
                }
                
                if (rate && !isNaN(rate) && rate > 0) {
                    // 為替レートの妥当性チェック（100〜200円の範囲）
                    if (rate >= 100 && rate <= 200) {
                        console.log(`Current USD/JPY rate: ${rate}`);
                        return rate;
                    } else {
                        console.warn(`USD/JPY rate out of realistic range: ${rate}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch USD/JPY rate:', error);
        }
        
        // フォールバック: 概算レート（2025年前後の典型的なレート範囲）
        console.log('Using fallback USD/JPY rate: 150');
        return 150;
    }
    
    async fetchFromYahoo(symbol) {
        try {
            // Yahoo Finance query APIを使用
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`Yahoo Finance API returned status: ${response.status}`);
                return null;
            }
            
            const data = await response.json();
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                
                // 価格を取得（複数のソースを試す）
                let quote = result.meta.regularMarketPrice;
                if (!quote && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
                    const quotes = result.indicators.quote[0].close;
                    if (quotes && quotes.length > 0) {
                        quote = quotes[quotes.length - 1];
                    }
                }
                
                // 通貨情報を取得
                const currency = result.meta.currency;
                
                console.log(`Fetched ${symbol}: ${quote} ${currency}`);
                
                if (quote && !isNaN(quote) && quote > 0) {
                    let priceInJPY = quote;
                    
                    // USDで返される場合はJPYに変換
                    // Yahoo FinanceのAPIは^N225をUSDで返すことがあるため、
                    // JPY換算が必要（為替レートは動的に取得、失敗時は概算値を使用）
                    if (currency === 'USD') {
                        // USD→JPY換算レートを動的に取得
                        const usdToJpyRate = await this.fetchUsdJpyRate();
                        priceInJPY = quote * usdToJpyRate;
                        console.log(`Currency conversion: ${quote} USD × ${usdToJpyRate} = ${priceInJPY} JPY`);
                    } else if (currency !== 'JPY') {
                        console.warn(`Unexpected currency: ${currency}, treating as JPY`);
                    }
                    
                    // 価格の妥当性チェック（日経225の現実的な範囲: 15,000〜60,000円）
                    if (priceInJPY < 15000 || priceInJPY > 60000) {
                        console.warn(`Price out of realistic range: ${priceInJPY} JPY`);
                        return null;
                    }
                    
                    return Math.round(priceInJPY * 100) / 100;
                }
            }
            
            console.error('Invalid data structure from Yahoo Finance API');
            return null;
        } catch (error) {
            console.error('Yahoo Finance fetch error:', error);
            return null;
        }
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
