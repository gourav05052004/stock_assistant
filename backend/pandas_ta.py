from __future__ import annotations

import pandas as pd


def _to_series(values) -> pd.Series:
    if isinstance(values, pd.Series):
        return values.astype(float)
    return pd.Series(values, dtype="float64")


def sma(close, length: int = 14) -> pd.Series:
    series = _to_series(close)
    return series.rolling(window=length, min_periods=length).mean()


def ema(close, length: int = 14) -> pd.Series:
    series = _to_series(close)
    return series.ewm(span=length, adjust=False, min_periods=length).mean()


def rsi(close, length: int = 14) -> pd.Series:
    series = _to_series(close)
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1 / length, adjust=False, min_periods=length).mean()
    avg_loss = loss.ewm(alpha=1 / length, adjust=False, min_periods=length).mean()

    relative_strength = avg_gain / avg_loss.replace(0, pd.NA)
    return 100 - (100 / (1 + relative_strength))


def macd(close, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    series = _to_series(close)
    macd_line = ema(series, length=fast) - ema(series, length=slow)
    signal_line = macd_line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    histogram = macd_line - signal_line

    return pd.DataFrame(
        {
            f"MACD_{fast}_{slow}_{signal}": macd_line,
            f"MACDs_{fast}_{slow}_{signal}": signal_line,
            f"MACDh_{fast}_{slow}_{signal}": histogram,
        }
    )


def bbands(close, length: int = 20, std: float = 2.0) -> pd.DataFrame:
    series = _to_series(close)
    middle = series.rolling(window=length, min_periods=length).mean()
    deviation = series.rolling(window=length, min_periods=length).std(ddof=0)
    upper = middle + std * deviation
    lower = middle - std * deviation
    bandwidth = ((upper - lower) / middle) * 100
    percent_b = (series - lower) / (upper - lower)

    suffix = f"{length}_{float(std):g}"
    return pd.DataFrame(
        {
            f"BBL_{suffix}": lower,
            f"BBM_{suffix}": middle,
            f"BBU_{suffix}": upper,
            f"BBB_{suffix}": bandwidth,
            f"BBP_{suffix}": percent_b,
        }
    )


def atr(high, low, close, length: int = 14) -> pd.Series:
    high_series = _to_series(high)
    low_series = _to_series(low)
    close_series = _to_series(close)

    previous_close = close_series.shift(1)
    true_range = pd.concat(
        [
            high_series - low_series,
            (high_series - previous_close).abs(),
            (low_series - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    return true_range.rolling(window=length, min_periods=length).mean()


def stoch(high, low, close, k: int = 14, d: int = 3, smooth_k: int = 3) -> pd.DataFrame:
    high_series = _to_series(high)
    low_series = _to_series(low)
    close_series = _to_series(close)

    lowest_low = low_series.rolling(window=k, min_periods=k).min()
    highest_high = high_series.rolling(window=k, min_periods=k).max()
    raw_k = 100 * (close_series - lowest_low) / (highest_high - lowest_low)
    stoch_k = raw_k.rolling(window=smooth_k, min_periods=smooth_k).mean()
    stoch_d = stoch_k.rolling(window=d, min_periods=d).mean()

    return pd.DataFrame(
        {
            f"STOCHk_{k}_{smooth_k}_{d}": stoch_k,
            f"STOCHd_{k}_{smooth_k}_{d}": stoch_d,
        }
    )


def obv(close, volume) -> pd.Series:
    close_series = _to_series(close)
    volume_series = _to_series(volume)

    direction = close_series.diff().fillna(0)
    signed_volume = volume_series.where(direction >= 0, -volume_series)
    signed_volume = signed_volume.where(direction != 0, 0)
    return signed_volume.cumsum()