export function shuffleArray<T>(arr: T[]) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

export const timer = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const secondsToTime = (seconds: number) => {
	try {
		return new Date(1000 * seconds).toISOString().substr(11, 8);
	} catch {
		return '0';
	}
};

const urlRegex = new RegExp(
	'^(https?:\\/\\/)?((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(#[-a-z\\d_]*)?$',
	'i',
);
export const isValidURL = (str: string) => {
	return urlRegex.exec(str);
};

export const splitArrayIntoChunks = <T>(arr: Array<T>, chunk: number) => {
	const result = [];
	for (let i = 0; i < arr.length; i += chunk) {
		const temp = arr.slice(i, i + chunk);
		result.push(temp);
	}
	return result;
};
