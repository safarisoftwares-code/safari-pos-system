async function loadAnalytics() {
    try {
        const data = await apiCall('/analytics/overview');
        
        // Top Sellers
        let topSellersHtml = '';
        data.top_sellers.forEach((item, i) => {
            topSellersHtml += '<tr><td>' + (i+1) + '</td><td>' + item.name + '</td><td>' + item.qty + '</td><td>KSh ' + item.revenue.toFixed(2) + '</td></tr>';
        });
        document.getElementById('topSellersBody').innerHTML = topSellersHtml || '<tr><td colspan="4">No sales yet</td></tr>';
        
        // Worst Sellers
        let worstSellersHtml = '';
        data.worst_sellers.forEach((item, i) => {
            worstSellersHtml += '<tr><td>' + (i+1) + '</td><td>' + item.name + '</td><td>' + item.qty + '</td><td>KSh ' + item.revenue.toFixed(2) + '</td></tr>';
        });
        document.getElementById('worstSellersBody').innerHTML = worstSellersHtml || '<tr><td colspan="4">No sales yet</td></tr>';
        
        // Profit Champions
        let profitHtml = '';
        data.profit_champions.forEach((item, i) => {
            profitHtml += '<tr><td>' + (i+1) + '</td><td>' + item.name + '</td><td style="color:#2e7d32">KSh ' + item.profit.toFixed(2) + '</td><td>' + item.margin + '%</td></tr>';
        });
        document.getElementById('profitChampionsBody').innerHTML = profitHtml || '<tr><td colspan="4">No cost data</td></tr>';
        
        // Loss Makers
        let lossHtml = '';
        data.loss_makers.forEach((item, i) => {
            lossHtml += '<tr><td>' + (i+1) + '</td><td>' + item.name + '</td><td style="color:#d32f2f">KSh ' + item.profit.toFixed(2) + '</td><td>' + item.margin + '%</td></tr>';
        });
        document.getElementById('lossMakersBody').innerHTML = lossHtml || '<tr><td colspan="4" style="color:#2e7d32">No loss makers!</td></tr>';
        
        // Slow Movers
        let slowHtml = '';
        data.slow_movers.forEach((item, i) => {
            slowHtml += '<tr><td>' + (i+1) + '</td><td>' + item.name + '</td><td>' + item.stock + '</td><td>' + item.sold_30days + '</td></tr>';
        });
        document.getElementById('slowMoversBody').innerHTML = slowHtml || '<tr><td colspan="4">No slow movers</td></tr>';
        
    } catch (e) { console.error('Analytics error:', e); }
}
