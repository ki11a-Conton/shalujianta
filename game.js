<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>杀戮尖塔 - ES6 模块化版本</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            overflow: hidden;
            background-color: #1a1a2e;
            font-family: 'Microsoft YaHei', sans-serif;
            user-select: none;
        }

        #gameCanvas {
            display: block;
            width: 100vw;
            height: 100vh;
        }

        /* 加载提示 */
        #loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #fff;
            font-size: 24px;
            text-align: center;
        }

        #loading.hidden {
            display: none;
        }
    </style>
</head>
<body>
    <!-- 加载提示 -->
    <div id="loading">
        <div>🎮 正在加载游戏...</div>
        <div style="font-size: 14px; margin-top: 10px; color: #888;">
            ES6 模块化版本
        </div>
    </div>

    <!-- 游戏画布 -->
    <canvas id="gameCanvas"></canvas>

    <!--
        使用 ES6 模块加载游戏
        type="module" 启用 ES6 模块支持
        src="src/main.js" 指向模块化入口文件
    -->
    <script type="module" src="src/main.js"></script>

    <script>
        // 页面加载完成后隐藏加载提示
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.getElementById('loading').classList.add('hidden');
            }, 500);
        });
    </script>
</body>
</html>
