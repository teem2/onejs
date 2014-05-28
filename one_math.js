"use strict"
// ONEJS JS and GLSL Math mappings and matrices

ONE.math_ = function(){

	// Matrix math adapted from https://github.com/toji/gl-matrix

	this.E = Math.E
	this.LN2 = Math.LN2
	this.LN10 = Math.LN10
	this.LOG2E = Math.LOG2E
	this.LOG10E = Math.LOG10E
	this.PI = Math.PI
	this.SQRT1_2 = Math.SQRT1_2
	this.SQRT2 = Math.SQRT2

	this.abs = Math.abs
	this.acos = Math.acos
	this.asin = Math.asin
	this.atan = Math.atan
	this.sin = Math.sin
	this.cos = Math.cos
	this.tan = Math.tan
	this.sqrt = Math.sqrt
	this.ceil = Math.ceil
	this.floor = Math.floor
	this.atan2 = Math.atan2
	this.exp = Math.exp
	this.log = Math.log
	this.max = Math.max
	this.min = Math.min
	this.random = Math.random

	this.mod = function( A, B ){
		return (A%B+B)%B
	}










	// vec 2










	this.vec2 = function( x, y ){
		return [x, y]
	}

	this.vec2.zero = function( O ){
		if(!O) O  = new Array(2)
		O[0] = O[1] = 0
		return O
	}

	this.vec2.random = function( S, O ){
		if(!O) O = new Array(2)
		S = S || 1.0
		var r = Math.random() * 2.0 * Math.PI
		O[0] = Math.cos(r) * S
		O[1] = Math.sin(r) * S
		return O
	}

	this.vec2.mat2 = function( M, V, O ){
		var x = V[0], y = V[1]
		if(!O) O = new Array(2)
		O[0] = M[0] * x + M[2] * y
		O[1] = M[1] * x + M[3] * y
		return O
	}

	this.vec2.mat3x2 = function( M, V, O ){
		var x = V[0], y = V[1]
		if(!O) O = new Array(2)
		O[0] = M[0] * x + M[2] * y + M[4]
		O[1] = M[1] * x + M[3] * y + M[5]
		return O
	}

	this.vec2.mat3 = function( M, V, O ){
		var x = V[0], y = V[1]
		if(!O) O = new Array(2)
		O[0] = M[0] * x + M[4] * y + M[6]
		O[1] = M[1] * x + M[4] * y + M[7]
		return O
	}

	this.vec2.mat4 = function( M, V, O ){
		var x = V[0], y = V[1]
		if(!O) O = new Array(2)
		O[0] = M[0] * x + M[4] * y + M[12]
		O[1] = M[1] * x + M[5] * y + M[13]
		return O
	}

	this.vec2.normalize = function( V, O ){
		if(!O) O = new Array(2)
		var x = V[0], y = V[1]
		var len = Math.sqrt(x * x + y * y)
		if(len == 0) O[0] = 0, O[1] = 0
		else O[0] = x/len, O[1] = y/len
		return O
	}

	this.vec2.distance = function( A, B ){
		var x = A[0] - B[0], y = A[1] - B[1]
		return Math.sqrt(x * x + y * y)
	}

	this.vec2.len = function( V ){
		var x = V[0], y = V[1]
		return Math.sqrt(x * x + y * y)
	}

	this.vec2.negate = function( V, O ){
		if(!O) O = new Array(2)
		O[0] =  - V[0], O[1] =  - V[1]
		return O
	}

	this.vec2.inverse = function( V, O ){
		if(!O) O = new Array(2)
		O[0] = 1./V[0], O[1] = 1./V[1]
		return O
	}

	this.vec2.dot = function( A, B ){
		return A[0] * B[0] + A[1] * B[1]
	}

	this.vec2.cross = function( A, B, O ){
		if(!O) O = new Array(2)
		var z = A[0] * B[1] - A[1] * B[0]
		O[0] = O[1] = 0
		O[2] = z
		return O
	}

	this.vec2.mix = function( A, B, f, O ){
		if(!O) O = new Array(2)
		var x = A[0], y = A[1]
		O[0] = x + f * (B[0] - x)
		O[1] = y + f * (B[1] - y)
		return O
	}

	this.vec2.clamp = function( V, L, U, O ){
		if(!O) O = new Array(2)
		var x = V[0], y = V[1]
		O[0] = x<L?L:x>U?U:x
		O[1] = y<L?L:y>U?U:y
		return O
	}

	this.vec2.clamp_ = function( V, L, U, O ){
		if(!O) O = new Array(2)
		var lx = L[0], ux = U[0], ly = L[1], uy = U[1]
		O[0] = x<lx?lx:x>ux?ux:x
		O[1] = y<ly?ly:y>uy?uy:y
		return O
	}

	this.vec2.step = function( V, S, O ){
		if(!O) O = new Array(2)
		O[0] = V[0]<S?0:1, O[1] = V[1]<S?0:1
		return O
	}

	this.vec2.step_ = function( V, S, O ){
		if(!O) O = new Array(2)
		O[0] = V[0]<S[0]?0:1, O[1] = V[1]<S[1]?0:1
		return O
	}

	this.vec2.sign = function( V ){
		var t
		O[0] = (t=V[0])<0?-1:t>0?1:0, O[1] = (t=V[1])<0?-1:t>0?1:0
		return O
	}

	this.vec2.cross = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] * R[1] - R[2]* L[1]
		return O
	}

	this.vec2.mul = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] * R, O[1] = L[1] * R
		return O
	}

	this.vec2.mul_ = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] * R[0], O[1] = L[1] * R[1]
		return O
	}

	this.vec2.add = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] + R, O[1] = L[1] + R
		return O
	}

	this.vec2.add_ = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] + R[0], O[1] = L[1] + R[1]
		return O
	}

	this.vec2.mod = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] % R, O[1] = L[1] % R
		return O
	}

	this.vec2.mod_ = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] % R[0], O[1] = L[1] % R[1]
		return O
	}

	this.vec2.div = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] / R, O[1] = L[1] / R
		return O
	}

	this.vec2.div_ = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = L[0] / R[0], O[1] = L[1] / R[1]
		return O
	}

	this.vec2.pow = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = Math.pow(L[0], R), O[1] = Math.pow(L[1], R)
		return O
	}

	this.vec2.pow_ = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = Math.pow(L[0], R[0]), O[1] = Math.pow(L[1], R[1])
		return O
	}

	this.vec2.mmod = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = Math.mmod(L[0], R), O[1] = Math.mmod(L[1], R)
		return O
	}

	this.vec2.mmod_ = function( L, R, O ){
		if(!O) O = new Array(2)
		O[0] = Math.mmod(L[0], R[0]), O[1] = Math.mmod(L[1], R[1])
		return O
	}

	this.vec2.greater = function( L, R ){
		return L[0] > R && L[1] > R
	}

	this.vec2.greater_ = function( L, R ){
		return L[0] > R[0] && L[1] > R[1]
	}

	this.vec2.greaterOrEqual = function( L, R ){
		return L[0] >= R && L[1] >= R
	}

	this.vec2.greaterOrEqual_ = function( L, R ){
		return L[0] >= R[0] && L[1] >= R[1]
	}

	this.vec2.less = function( L, R ){
		return L[0] < R && L[1] < R
	}

	this.vec2.less_ = function( L, R ){
		return L[0] < R[0] && L[1] < R[1]
	}

	this.vec2.lessOrEqual = function( L, R ){
		return L[0] <= R && L[1] <= R
	}

	this.vec2.lessOrEqual_ = function( L, R ){
		return L[0] <= R[0] && L[1] <= R[1]
	}

	this.vec2.equal = function( L, R ){
		return L[0] == R && L[1] == R
	}

	this.vec2.equal_ = function( L, R ){
		return L[0] == R[0] && L[1] == R[1]
	}

	this.vec2.notEqual = function( L, R ){
		return L[0] != R && L[1] != R
	}

	this.vec2.notEqual_ = function( L, R ){
		return L[0] != R[0] && L[1] != R[1]
	}

	this.vec2.abs = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.abs(A[0]), O[1] = Math.abs(A[1])
		return O
	}

	this.vec2.acos = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.acos(A[0]), O[1] = Math.acos(A[1])
		return O
	}

	this.vec2.asin = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.asin(A[0]), O[1] = Math.asin(A[1])
		return O
	}

	this.vec2.atan = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.atan(A[0]), O[1] = Math.atan(A[1])
		return O
	}

	this.vec2.sin = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.sin(A[0]), O[1] = Math.sin(A[1])
		return O
	}

	this.vec2.cos = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.cos(A[0]), O[1] = Math.cos(A[1])
		return O
	}

	this.vec2.tan = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.tan(A[0]), O[1] = Math.tan(A[1])
		return O
	}

	this.vec2.sqrt = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.sqrt(A[0]), O[1] = Math.sqrt(A[1])
		return O
	}

	this.vec2.ceil = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.ceil(A[0]), O[1] = Math.ceil(A[1])
		return O
	}

	this.vec2.floor = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.floor(A[0]), O[1] = Math.floor(A[1])
		return O
	}

	this.vec2.atan2 = function( A, B, O ){
		if(!O) O = new Array(2)
		O[0] = Math.atan2(A[0],B[0]), O[1] = Math.atan2(A[1],B[1])
		return O
	}

	this.vec2.exp = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.exp(A[0]), O[1] = Math.exp(A[1])
		return O
	}

	this.vec2.log = function( A, O ){
		if(!O) O = new Array(2)
		O[0] = Math.log(A[0]), O[1] = Math.log(A[1])
		return O
	}

	this.vec2.max = function( A, B, O ){
		if(!O) O = new Array(2)
		O[0] = Math.max(A[0],B[0]), O[1] = Math.max(A[1],B[1])
		return O
	}

	this.vec2.min = function( A, B, O ){
		if(!O) O = new Array(2)
		O[0] = Math.min(A[0],B[0]), O[1] = Math.min(A[1],B[1])
		return O
	}












	// vec 3










	this.vec3 = function( x, y, z ){
		return [x, y, z]
	}

	this.vec3.zero = function( O ){
		if(!O) O  = new Array(3)
		O[0] = O[1] = O[2] = 0
		return O
	}

	this.vec3.random = function( S, O ){
		if(!O) O = new Array(3)
		S = S || 1.0
		var r = Math.random() * 2.0 * Math.PI
		var z = (Math.random() * 2.0) - 1.0
		var zs = Math.sqrt(1.0 - z*z) * S
		O[0] = Math.cos(r) * zs
		O[1] = Math.sin(r) * zs
		O[2] = z * S
		return O
	}

	this.vec3.mat3 = function( M, V, O ){
		if(!O) O = new Array(3)
		var x = V[0], y = V[1], z = V[2]
		O[0] = x * M[0] + y * M[3] + z * M[6]
		O[1] = x * M[1] + y * M[4] + z * M[7]
		O[2] = x * M[2] + y * M[5] + z * M[8]
		return O
	}

	this.vec3.mat4 = function( M, V, O ){
		if(!O) O = new Array(3)
		var x = V[0], y = V[1], z = V[2],
			w = M[3] * x + M[7] * y + M[11] * z + M[15]
		w = w || 1.0
		O[0] = (M[0] * x + M[4] * y + M[8] * z + M[12]) / w
		O[1] = (M[1] * x + M[5] * y + M[9] * z + M[13]) / w
		O[2] = (M[2] * x + M[6] * y + M[10] * z + M[14]) / w
		return O
	}

	this.vec3.quat = function( Q, V, O ){
		if(!O) O = new Array(3)
		var x = V[0], y = V[1], z = V[2],
			qx = Q[0], qy = Q[1], qz = Q[2], qw = Q[3],
		// calculate quat * vec
			ix = qw * x + qy * z - qz * y,
			iy = qw * y + qz * x - qx * z,
			iz = qw * z + qx * y - qy * x,
			iw = -qx * x - qy * y - qz * z
		// calculate result * inverse quat
		O[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy
		O[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz
		O[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx
		return O
	}

	this.vec3.normalize = function( V, O ){
		if(!O) O = new Array(3)
		var x = V[0], y = V[1], z = V[2]
		var len = Math.sqrt(x * x + y * y + z * z)
		if(len == 0) O[0] = 0, O[1] = 0, O[2] = 0
		else O[0] = x/len, O[1] = y/len, O[2] = z/len
		return O
	}

	this.vec3.distance = function( A, B ){
		var x = A[0] - B[0], y = A[1] - B[1], z = A[2] - B[2]
		return Math.sqrt(x * x + y * y + z * z)
	}

	this.vec3.len = function( V ){
		var x = V[0], y = V[1], z = V[2]
		return Math.sqrt(x * x + y * y + z * z)
	}

	this.vec3.negate = function( V, O ){
		if(!O) O = new Array(3)
		O[0] =  - V[0], O[1] =  - V[1], O[2] =  - V[2]
		return O
	}

	this.vec3.inverse = function( V, O ){
		if(!O) O = new Array(3)
		O[0] = 1./V[0], O[1] = 1./V[1], O[2] = 1./V[2]
		return O
	}

	this.vec3.dot = function( A, B ){
		return A[0] * B[0] + A[1] * B[1] + A[2] * B[2]
	}

	this.vec3.mix = function( A, B, f, O ){
		if(!O) O = new Array(3)
		var x = A[0], y = A[1], z = A[2]
		O[0] = x + f * (B[0] - x)
		O[1] = y + f * (B[1] - y)
		O[2] = z + f * (B[2] - z)
		return O
	}

	this.vec3.clamp = function( V, L, U, O ){
		if(!O) O = new Array(3)
		var x = V[0], y = V[1], z = V[2]
		O[0] = x<L?L:x>U?U:x
		O[1] = y<L?L:y>U?U:y
		O[2] = z<L?L:z>U?U:z
		return O
	}

	this.vec3.clamp_ = function( V, L, U, O ){
		if(!O) O = new Array(3)
		var lx = L[0], ux = U[0], ly = L[1], uy = U[1], lz = L[2], uz = U[2]
		O[0] = x<lx?lx:x>ux?ux:x
		O[1] = y<ly?ly:y>uy?uy:y
		O[2] = z<lz?lz:z>uz?uz:z
		return O
	}

	this.vec3.step = function( V, S, O ){
		if(!O) O = new Array(3)
		O[0] = V[0]<S?0:1, O[1] = V[1]<S?0:1, O[2] = V[2]<S?0:1
		return O
	}

	this.vec3.step_ = function( V, S, O ){
		if(!O) O = new Array(3)
		O[0] = V[0]<S[0]?0:1, O[1] = V[1]<S[1]?0:1, O[2] = V[2]<S[2]?0:1
		return O
	}

	this.vec3.sign = function( V ){
		var t
		O[0] = (t=V[0])<0?-1:t>0?1:0, O[1] = (t=V[1])<0?-1:t>0?1:0, O[2] = (t=V[2])<0?-1:t>0?1:0
		return O
	}

	this.vec3.cross = function( A, B, O ){
		if(!O) O = new Array(3)
		var ax = A[0], ay = A[1], az = A[3], 
			bx = B[0], by = B[1], bz = B[2]
		O[0] = ay * bz - az * by
		O[1] = az * bx - ax * bz
		O[2] = ax * by - ay * bx
		return O
	}

	this.vec3.mul = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] * R, O[1] = L[1] * R, O[2] = L[2] * R
		return O
	}

	this.vec3.mul_ = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] * R[0], O[1] = L[1] * R[1], O[2] = L[2] * R[2]
		return O
	}

	this.vec3.add = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] + R, O[1] = L[1] + R, O[2] = L[2] + R
		return O
	}

	this.vec3.add_ = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] + R[0], O[1] = L[1] + R[1], O[2] = L[2] + R[2]
		return O
	}

	this.vec3.mod = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] % R, O[1] = L[1] % R, O[2] = L[2] % R
		return O
	}

	this.vec3.mod_ = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] % R[0], O[1] = L[1] % R[1], O[2] = L[2] % R[2]
		return O
	}

	this.vec3.div = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] / R, O[1] = L[1] / R, O[2] = L[2] / R
		return O
	}

	this.vec3.div_ = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = L[0] / R[0], O[1] = L[1] / R[1], O[2] = L[2] / R[2]
		return O
	}

	this.vec3.pow = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = Math.pow(L[0], R), O[1] = Math.pow(L[1], R), O[2] = Math.pow(L[2], R)
		return O
	}

	this.vec3.pow_ = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = Math.pow(L[0], R[0]), O[1] = Math.pow(L[1], R[1]), O[2] = Math.pow(L[2], R[2])
		return O
	}

	this.vec3.mmod = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = Math.mmod(L[0], R), O[1] = Math.mmod(L[1], R), O[2] = Math.mmod(L[2], R)
		return O
	}

	this.vec3.mmod_ = function( L, R, O ){
		if(!O) O = new Array(3)
		O[0] = Math.mmod(L[0], R[0]), O[1] = Math.mmod(L[1], R[1]), O[2] = Math.mmod(L[2], R[2])
		return O
	}

	this.vec3.greater = function( L, R ){
		return L[0] > R && L[1] > R && L[2] > R
	}

	this.vec3.greater_ = function( L, R ){
		return L[0] > R[0] && L[1] > R[1] && L[2] > R[2]
	}

	this.vec3.greaterOrEqual = function( L, R ){
		return L[0] >= R && L[1] >= R && L[2] >= R
	}

	this.vec3.greaterOrEqual_ = function( L, R ){
		return L[0] >= R[0] && L[1] >= R[1] && L[2] >= R[2]
	}

	this.vec3.less = function( L, R ){
		return L[0] < R && L[1] < R && L[2] < R
	}

	this.vec3.less_ = function( L, R ){
		return L[0] < R[0] && L[1] < R[1] && L[2] < R[2]
	}

	this.vec3.lessOrEqual = function( L, R ){
		return L[0] <= R && L[1] <= R && L[2] <= R
	}

	this.vec3.lessOrEqual_ = function( L, R ){
		return L[0] <= R[0] && L[1] <= R[1] && L[2] <= R[2]
	}

	this.vec3.equal = function( L, R ){
		return L[0] == R && L[1] == R && L[2] == R
	}

	this.vec3.equal_ = function( L, R ){
		return L[0] == R[0] && L[1] == R[1] && L[2] == R[2]
	}

	this.vec3.notEqual = function( L, R ){
		return L[0] != R && L[1] != R && L[2] != R
	}

	this.vec3.notEqual_ = function( L, R ){
		return L[0] != R[0] && L[1] != R[1] && L[2] != R[2]
	}

	this.vec3.abs = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.abs(A[0]), O[1] = Math.abs(A[1]), O[2] = Math.abs(A[2])
		return O
	}

	this.vec3.acos = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.acos(A[0]), O[1] = Math.acos(A[1]), O[2] = Math.acos(A[2])
		return O
	}

	this.vec3.asin = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.asin(A[0]), O[1] = Math.asin(A[1]), O[2] = Math.asin(A[2])
		return O
	}

	this.vec3.atan = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.atan(A[0]), O[1] = Math.atan(A[1]), O[2] = Math.atan(A[2])
		return O
	}

	this.vec3.sin = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.sin(A[0]), O[1] = Math.sin(A[1]), O[2] = Math.sin(A[2])
		return O
	}

	this.vec3.cos = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.cos(A[0]), O[1] = Math.cos(A[1]), O[2] = Math.cos(A[2])
		return O
	}

	this.vec3.tan = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.tan(A[0]), O[1] = Math.tan(A[1]), O[2] = Math.tan(A[2])
		return O
	}

	this.vec3.sqrt = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.sqrt(A[0]), O[1] = Math.sqrt(A[1]), O[2] = Math.sqrt(A[2])
		return O
	}

	this.vec3.ceil = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.ceil(A[0]), O[1] = Math.ceil(A[1]), O[2] = Math.ceil(A[2])
		return O
	}

	this.vec3.floor = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.floor(A[0]), O[1] = Math.floor(A[1]), O[2] = Math.floor(A[2])
		return O
	}

	this.vec3.atan2 = function( A, B, O ){
		if(!O) O = new Array(3)
		O[0] = Math.atan2(A[0],B[0]), O[1] = Math.atan2(A[1],B[1]), O[2] = Math.atan2(A[2],B[2])
		return O
	}

	this.vec3.exp = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.exp(A[0]), O[1] = Math.exp(A[1]), O[2] = Math.exp(A[2])
		return O
	}

	this.vec3.log = function( A, O ){
		if(!O) O = new Array(3)
		O[0] = Math.log(A[0]), O[1] = Math.log(A[1]), O[2] = Math.log(A[2])
		return O
	}

	this.vec3.max = function( A, B, O ){
		if(!O) O = new Array(3)
		O[0] = Math.max(A[0],B[0]), O[1] = Math.max(A[1],B[1]), O[2] = Math.max(A[2],B[2])
		return O
	}

	this.vec3.min = function( A, B, O ){
		if(!O) O = new Array(3)
		O[0] = Math.min(A[0],B[0]), O[1] = Math.min(A[1],B[1]), O[2] = Math.min(A[2],B[2])
		return O
	}







	// vec4








	this.vec4 = function( x, y, z, w ){
		return [x, y, z, w]
	}

	this.vec4.zero = function( O ){
		if(!O) O  = new Array(4)
		O[0] = O[1] = O[2] = O[3] = 0
		return O
	}

	this.vec4.random = function( S, O ){
		S = S || 1.0
		if(!O) O = new Array(4)
		O[0] = GLMAT_RANDOM()
		O[1] = GLMAT_RANDOM()
		O[2] = GLMAT_RANDOM()
		O[3] = GLMAT_RANDOM()
		this.normalize(O, O)
		this.mul(O, S, O)
		return O
	}

	this.vec4.mat4 = function( M, V, O ){
		var x = V[0], y = V[1], z = V[2], w = V[3]
		O[0] = M[0] * x + M[4] * y + M[8] * z + M[12] * w
		O[1] = M[1] * x + M[5] * y + M[9] * z + M[13] * w
		O[2] = M[2] * x + M[6] * y + M[10] * z + M[14] * w
		O[3] = M[3] * x + M[7] * y + M[11] * z + M[15] * w
		return O
	}

	this.vec4.quat = function( Q, V, O ){
		if(!O) O = new Array(4)
		var x = a[0], y = a[1], z = a[2],
			qx = q[0], qy = q[1], qz = q[2], qw = q[3],
			// calculate quat * vec
			ix = qw * x + qy * z - qz * y,
			iy = qw * y + qz * x - qx * z,
			iz = qw * z + qx * y - qy * x,
			iw = -qx * x - qy * y - qz * z
		// calculate result * inverse quat
		O[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy
		O[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz
		O[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx
		return O
	}

	this.vec4.normalize = function( V, O ){
		if(!O) O = new Array(4)
		var x = V[0], y = V[1], z = V[2], w = V[3]
		var len = Math.sqrt(x * x + y * y + z * z + w * w)
		if(len == 0) O[0] = 0, O[1] = 0, O[2] = 0, O[3] = 0
		else O[0] = x/len, O[1] = y/len, O[2] = z/len, O[3] = w/len
		return O
	}

	this.vec4.distance = function( A, B ){
		var x = A[0] - B[0], y = A[1] - B[1], z = A[2] - B[2], w = A[3] - B[3]
		return Math.sqrt(x * x + y * y + z * z + w * w)
	}

	this.vec4.len = function( V ){
		var x = V[0], y = V[1], z = V[2], w = V[3]
		return Math.sqrt(x * x + y * y + z * z + w * w)
	}

	this.vec4.negate = function( V, O ){
		if(!O) O = new Array(4)
		O[0] =  - V[0], O[1] =  - V[1], O[2] =  - V[2], O[3] =  - V[3]
		return O
	}

	this.vec4.inverse = function( V, O ){
		if(!O) O = new Array(4)
		O[0] = 1./V[0], O[1] = 1./V[1], O[2] = 1./V[2], O[3] = 1./V[3]
		return O
	}

	this.vec4.dot = function( A, B ){
		return A[0] * B[0] + A[1] * B[1] + A[2] * B[2] + A[3] * B[3]
	}

	this.vec4.mix = function( A, B, f, O ){
		if(!O) O = new Array(4)
		var x = A[0], y = A[1], z = A[2], w = A[3]
		O[0] = x + f * (B[0] - x)
		O[1] = y + f * (B[1] - y)
		O[2] = z + f * (B[2] - z)
		O[3] = w + f * (B[3] - w)

		return O
	}

	this.vec4.clamp = function( V, L, U, O ){
		if(!O) O = new Array(4)
		var x = V[0], y = V[1], z = V[2], w = V[3]
		O[0] = x<L?L:x>U?U:x
		O[1] = y<L?L:y>U?U:y
		O[2] = z<L?L:z>U?U:z
		O[3] = w<L?L:w>U?U:w
		return O
	}

	this.vec4.clamp_ = function( V, L, U, O ){
		if(!O) O = new Array(4)
		var lx = L[0], ux = U[0], ly = L[1], uy = U[1], lz = L[2], uz = U[2], lw = L[3], uw = U[3]
		O[0] = x<lx?lx:x>ux?ux:x
		O[1] = y<ly?ly:y>uy?uy:y
		O[2] = z<lz?lz:z>uz?uz:z
		O[3] = w<lw?lw:w>uw?uw:w
		return O
	}

	this.vec4.step = function( V, S, O ){
		if(!O) O = new Array(4)
		O[0] = V[0]<S?0:1, O[1] = V[1]<S?0:1, O[2] = V[2]<S?0:1, O[3] = V[3]<S?0:1
		return O
	}

	this.vec4.step_ = function( V, S, O ){
		if(!O) O = new Array(4)
		O[0] = V[0]<S[0]?0:1, O[1] = V[1]<S[1]?0:1, O[2] = V[2]<S[2]?0:1, O[3] = V[3]<S[3]?0:1
		return O
	}

	this.vec4.sign = function( V ){
		var t
		O[0] = (t=V[0])<0?-1:t>0?1:0, O[1] = (t=V[1])<0?-1:t>0?1:0, O[2] = (t=V[2])<0?-1:t>0?1:0, O[3] = (t=V[3])<0?-1:t>0?1:0
		return O
	}

	this.vec4.mul = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] * R, O[1] = L[1] * R, O[2] = L[2] * R, O[3] = L[3] * R
		return O
	}

	this.vec4.mul_ = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] * R[0], O[1] = L[1] * R[1], O[2] = L[2] * R[2], O[3] = L[3] * R[3]
		return O
	}

	this.vec4.add = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] + R, O[1] = L[1] + R, O[2] = L[2] + R, O[3] = L[3] + R
		return O
	}

	this.vec4.add_ = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] + R[0], O[1] = L[1] + R[1], O[2] = L[2] + R[2], O[3] = L[3] + R[3]
		return O
	}

	this.vec4.mod = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] % R, O[1] = L[1] % R, O[2] = L[2] % R, O[3] = L[3] % R
		return O
	}

	this.vec4.mod_ = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] % R[0], O[1] = L[1] % R[1], O[2] = L[2] % R[2], O[3] = L[3] % R[3]
		return O
	}

	this.vec4.div = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] / R, O[1] = L[1] / R, O[2] = L[2] / R, O[3] = L[3] / R
		return O
	}

	this.vec4.div_ = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = L[0] / R[0], O[1] = L[1] / R[1], O[2] = L[2] / R[2], O[3] = L[3] / R[3]
		return O
	}

	this.vec4.pow = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = Math.pow(L[0], R), O[1] = Math.pow(L[1], R), O[2] = Math.pow(L[2], R), O[3] = Math.pow(L[3], R)
		return O
	}

	this.vec4.pow_ = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = Math.pow(L[0], R[0]), O[1] = Math.pow(L[1], R[1]), O[2] = Math.pow(L[2], R[2]), O[3] = Math.pow(L[3], R[3])
		return O
	}

	this.vec4.mmod = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = Math.mmod(L[0], R), O[1] = Math.mmod(L[1], R), O[2] = Math.mmod(L[2], R), O[3] = Math.mmod(L[3], R)
		return O
	}

	this.vec4.mmod_ = function( L, R, O ){
		if(!O) O = new Array(4)
		O[0] = Math.mmod(L[0], R[0]), O[1] = Math.mmod(L[1], R[1]), O[2] = Math.mmod(L[2], R[2]), O[3] = Math.mmod(L[3], R[3])
		return O
	}

	this.vec4.greater = function( L, R ){
		return L[0] > R && L[1] > R && L[2] > R && L[3] > R
	}

	this.vec4.greater_ = function( L, R ){
		return L[0] > R[0] && L[1] > R[1] && L[2] > R[2] && L[3] > R[3]
	}

	this.vec4.greaterOrEqual = function( L, R ){
		return L[0] >= R && L[1] >= R && L[2] >= R && L[3] >= R
	}

	this.vec4.greaterOrEqual_ = function( L, R ){
		return L[0] >= R[0] && L[1] >= R[1] && L[2] >= R[2] && L[3] >= R[3]
	}

	this.vec4.less = function( L, R ){
		return L[0] < R && L[1] < R && L[2] < R && L[3] < R
	}

	this.vec4.less_ = function( L, R ){
		return L[0] < R[0] && L[1] < R[1] && L[2] < R[2] && L[3] < R[3]
	}

	this.vec4.lessOrEqual = function( L, R ){
		return L[0] <= R && L[1] <= R && L[2] <= R && L[3] <= R
	}

	this.vec4.lessOrEqual_ = function( L, R ){
		return L[0] <= R[0] && L[1] <= R[1] && L[2] <= R[2] && L[3] <= R[3]
	}

	this.vec4.equal = function( L, R ){
		return L[0] == R && L[1] == R && L[2] == R && L[3] == R
	}

	this.vec4.equal_ = function( L, R ){
		return L[0] == R[0] && L[1] == R[1] && L[2] == R[2] && L[3] == R[3]
	}

	this.vec4.notEqual = function( L, R ){
		return L[0] != R && L[1] != R && L[2] != R && L[3] != R
	}

	this.vec4.notEqual_ = function( L, R ){
		return L[0] != R[0] && L[1] != R[1] && L[2] != R[2] && L[3] != R[3]
	}

	this.vec4.abs = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.abs(A[0]), O[1] = Math.abs(A[1]), O[2] = Math.abs(A[2]), O[3] = Math.abs(A[3])
		return O
	}

	this.vec4.acos = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.acos(A[0]), O[1] = Math.acos(A[1]), O[2] = Math.acos(A[2]), O[3] = Math.acos(A[3])
		return O
	}

	this.vec4.asin = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.asin(A[0]), O[1] = Math.asin(A[1]), O[2] = Math.asin(A[2]), O[3] = Math.asin(A[3])
		return O
	}

	this.vec4.atan = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.atan(A[0]), O[1] = Math.atan(A[1]), O[2] = Math.atan(A[2]), O[3] = Math.atan(A[3])
		return O
	}

	this.vec4.sin = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.sin(A[0]), O[1] = Math.sin(A[1]), O[2] = Math.sin(A[2]), O[3] = Math.sin(A[3])
		return O
	}

	this.vec4.cos = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.cos(A[0]), O[1] = Math.cos(A[1]), O[2] = Math.cos(A[2]), O[3] = Math.cos(A[3])
		return O
	}

	this.vec4.tan = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.tan(A[0]), O[1] = Math.tan(A[1]), O[2] = Math.tan(A[2]), O[3] = Math.tan(A[3])
		return O
	}

	this.vec4.sqrt = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.sqrt(A[0]), O[1] = Math.sqrt(A[1]), O[2] = Math.sqrt(A[2]), O[3] = Math.sqrt(A[3])
		return O
	}

	this.vec4.ceil = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.ceil(A[0]), O[1] = Math.ceil(A[1]), O[2] = Math.ceil(A[2]), O[3] = Math.ceil(A[3])
		return O
	}

	this.vec4.floor = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.floor(A[0]), O[1] = Math.floor(A[1]), O[2] = Math.floor(A[2]), O[3] = Math.floor(A[3])
		return O
	}

	this.vec4.atan2 = function( A, B, O ){
		if(!O) O = new Array(4)
		O[0] = Math.atan2(A[0],B[0]), O[1] = Math.atan2(A[1],B[1]), O[2] = Math.atan2(A[2],B[2]), O[3] = Math.atan2(A[3],B[3])
		return O
	}

	this.vec4.exp = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.exp(A[0]), O[1] = Math.exp(A[1]), O[2] = Math.exp(A[2]), O[3] = Math.exp(A[3])
		return O
	}

	this.vec4.log = function( A, O ){
		if(!O) O = new Array(4)
		O[0] = Math.log(A[0]), O[1] = Math.log(A[1]), O[2] = Math.log(A[2]), O[3] = Math.log(A[3])
		return O
	}

	this.vec4.max = function( A, B, O ){
		if(!O) O = new Array(4)
		O[0] = Math.max(A[0],B[0]), O[1] = Math.max(A[1],B[1]), O[2] = Math.max(A[2],B[2]), O[3] = Math.max(A[3],B[3])
		return O
	}

	this.vec4.min = function( A, B, O ){
		if(!O) O = new Array(4)
		O[0] = Math.min(A[0],B[0]), O[1] = Math.min(A[1],B[1]), O[2] = Math.min(A[2],B[2]), O[3] = Math.min(A[3],B[3])
		return O
	}







	// mat 2








	this.mat2 = function( a, b, c, d ){
		return [a, b, c, d]
	}

	this.mat2.mat2 = function( O ){
		if(!O) O  = new Array(4)
		O[0] = O[1] = 
		O[2] = O[3] = 0
		return O
	}

	this.mat2.identity = function( O ){
		if(!O) O = new Array(4)
		O[0] = 1, O[1] = 0,
		O[2] = 0, O[3] = 1
		return O
	}

	this.mat2.transpose = function( M, O ){
		if(O === M) {
			var m1 = M[1]
			O[1] = M[2]
			O[2] = m1
		}
		else {
			if(!O) O = new Array(4)
			O[0] = M[0], O[1] = M[2]
			O[2] = M[1], O[3] = M[3]
		}
		return O
	}
	
	this.mat2.invert = function( M, O ) {
		if(!O) O = new Array(4)
		var m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3],
			d = m0 * m3 - m2 * m1

		if (!d) return null
		d = 1.0 / d		
		O[0] =  m3 * d, O[1] = -m1 * d
		O[2] = -m2 * d, O[3] =  m0 * d
		return O
	}

	this.mat2.adjoint = function( M, O ){
		if(!O) O = new Array(4)
		var m0 = M[0]
		O[0] =  M[3], O[1] = -M[1]
		O[2] = -M[2], O[3] =  m0
		return O
	}

	this.mat2.determinant = function( M ){
		return M[0] * M[3] - M[2] * M[1]
	}

	this.mat2.mul = 
	this.mat2.mat2 = function( A, B, O ){
		if(!O) O = new Array(4)
		var a0 = A[0], a1 = A[1], a2 = A[2], a3 = A[3]
		var b0 = B[0], b1 = B[1], b2 = B[2], b3 = B[3]
		O[0] = a0 * b0 + a2 * b1, O[1] = a1 * b0 + a3 * b1
		O[2] = a0 * b2 + a2 * b3, O[3] = a1 * b2 + a3 * b3
		return O
	}

	this.mat2.rotate = function( M, A, O ){
		if(!O) O = new Array(4)
		var m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3],
			s = Math.sin(rad), c = Math.cos(rad)
		O[0] = m0 *  c + m2 * s, O[1] = m1 *  c + m3 * s
		O[2] = m0 * -s + m2 * c, O[3] = m1 * -s + m3 * c
		return O
	}

	this. mat2.scale = function( M, S, O ){
		var m0 = M[0], m1 = M[1], m2 = V[2], m3 = V[3],
			s0 = S[0], s1 = S[1]
		O[0] = m0 * s0, O[1] = m1 * s0
		O[2] = m2 * s1, O[3] = m3 * s1
		return O
	}







	// mat 3







	this.mat3 = function(  ){
		return Array.prototype.slice.call(arguments,0)
	}

	this.mat3.zero = function( O ){
		if(!O) O  = new Array(9)
		O[0] = O[1] = O[2] =
		O[3] = O[4] = O[5] =
		O[6] = O[7] = O[8] = 0
		return O
	}

	this.mat3.identity = function( O ){
		if(!O) O = new Array(9)
		O[0] = 1, O[1] = 0, O[2] = 0
		O[3] = 0, O[4] = 1, O[5] = 0
		O[6] = 0, O[7] = 0, O[8] = 1
		return O
	}

	this.mat3.transpose = function( M, O ){
		// If we are transposing ourselves we can skip M few steps but have to cache some values
		if(!O) O = new Array(9)
		if (O === M) {
			var m01 = M[1], m02 = M[2], m12 = M[5]
			O[1] = M[3], O[2] = M[6], O[3] = m01
			O[5] = M[7], O[6] = m02, O[7] = m12
		} else {
			O[0] = M[0], O[1] = M[3], O[2] = M[6]
			O[3] = M[1], O[4] = M[4], O[5] = M[7]
			O[6] = M[2], O[7] = M[5], O[8] = M[8]
		}
		return O
	}

	this.mat3.invert = function( M, O ){
		if(!O) O = new Array(9)
		var m00 = M[0], m01 = M[1], m02 = M[2],
			m10 = M[3], m11 = M[4], m12 = M[5],
			m20 = M[6], m21 = M[7], m22 = M[8],
			b01 = m22 * m11 - m12 * m21,
			b11 = -m22 * m10 + m12 * m20,
			b21 = m21 * m10 - m11 * m20,
			d = m00 * b01 + m01 * b11 + m02 * b21

		if (!d) return null

		d = 1.0 / d

		O[0] = b01 * d
		O[1] = (-m22 * m01 + m02 * m21) * d
		O[2] = (m12 * m01 - m02 * m11) * d
		O[3] = b11 * d
		O[4] = (m22 * m00 - m02 * m20) * d
		O[5] = (-m12 * m00 + m02 * m10) * d
		O[6] = b21 * d
		O[7] = (-m21 * m00 + m01 * m20) * d
		O[8] = (m11 * m00 - m01 * m10) * d
		return O
	}

	this.mat3.adjoint = function( M, O ){
		if(!O) O = new Array(9)
		var a00 = M[0], a01 = M[1], a02 = M[2],
			a10 = M[3], a11 = M[4], a12 = M[5],
			a20 = M[6], a21 = M[7], a22 = M[8]

		O[0] = (a11 * a22 - a12 * a21)
		O[1] = (a02 * a21 - a01 * a22)
		O[2] = (a01 * a12 - a02 * a11)
		O[3] = (a12 * a20 - a10 * a22)
		O[4] = (a00 * a22 - a02 * a20)
		O[5] = (a02 * a10 - a00 * a12)
		O[6] = (a10 * a21 - a11 * a20)
		O[7] = (a01 * a20 - a00 * a21)
		O[8] = (a00 * a11 - a01 * a10)
		return O
	}

	this.mat3.determinant = function( M ){
		var a00 = M[0], a01 = M[1], a02 = M[2],
			a10 = M[3], a11 = M[4], a12 = M[5],
			a20 = M[6], a21 = M[7], a22 = M[8]

		return a00 * (a22 * a11 - a12 * a21) + 
			   a01 * (-a22 * a10 + a12 * a20) + 
			   a02 * (a21 * a10 - a11 * a20)
	}

	this.mat3.mul = 
	this.mat3.mat3 = function ( A, B, O ){
		if(!O) O = new Array(9)
		var a00 = A[0], a01 = A[1], a02 = A[2],
			a10 = A[3], a11 = A[4], a12 = A[5],
			a20 = A[6], a21 = A[7], a22 = A[8],

			b00 = B[0], b01 = B[1], b02 = B[2],
			b10 = B[3], b11 = B[4], b12 = B[5],
			b20 = B[6], b21 = B[7], b22 = B[8]

		O[0] = b00 * a00 + b01 * a10 + b02 * a20
		O[1] = b00 * a01 + b01 * a11 + b02 * a21
		O[2] = b00 * a02 + b01 * a12 + b02 * a22

		O[3] = b10 * a00 + b11 * a10 + b12 * a20
		O[4] = b10 * a01 + b11 * a11 + b12 * a21
		O[5] = b10 * a02 + b11 * a12 + b12 * a22

		O[6] = b20 * a00 + b21 * a10 + b22 * a20
		O[7] = b20 * a01 + b21 * a11 + b22 * a21
		O[8] = b20 * a02 + b21 * a12 + b22 * a22
		return O
	}

	this.mat3.translate = function( M, V, O ){
		if(!O) O = new Array(9)
		var m00 = M[0], m01 = M[1], m02 = M[2],
			m10 = M[3], m11 = M[4], m12 = M[5],
			m20 = M[6], m21 = M[7], m22 = M[8],
			x = v[0], y = v[1]

		O[0] = m00,	O[1] = m01, O[2] = m02
		O[3] = m10, O[4] = m11, O[5] = m12
		O[6] = x * m00 + y * m10 + m20
		O[7] = x * m01 + y * m11 + m21
		O[8] = x * m02 + y * m12 + m22
		return O
	}

	this.mat3.rotate = function( M, A, O ) {
		if(!O) O = new Array(9)
		var m00 = M[0], m01 = M[1], m02 = M[2],
			m10 = M[3], m11 = M[4], m12 = M[5],
			m20 = M[6], m21 = M[7], m22 = M[8],
			s = Math.sin(rad), c = Math.cos(rad)

		O[0] = c * m00 + s * m10, O[1] = c * m01 + s * m11, O[2] = c * m02 + s * m12
		O[3] = c * m10 - s * m00, O[4] = c * m11 - s * m01, O[5] = c * m12 - s * m02
		O[6] = m20,               O[7] = m21,               O[8] = m22
		return O
	}

	this.mat3.scale = function( M, V, O ){
		if(!O) O = new Array(9)
		var x = v[0], y = v[1]
		O[0] = x * M[0], O[1] = x * M[1], O[2] = x * M[2]
		O[3] = y * M[3], O[4] = y * M[4], O[5] = y * M[5]
		O[6] = M[6],     O[7] = M[7],     O[8] = M[8]
		return O
	}

	this.mat3.fromQuat = function( Q, O ){
		var x = Q[0], y = Q[1], z = Q[2], w = Q[3],
			x2 = x + x,  y2 = y + y,  z2 = z + z,
			xx = x * x2, yx = y * x2, yy = y * y2,
			zx = z * x2, zy = z * y2, zz = z * z2,
			wx = w * x2, wy = w * y2, wz = w * z2

		O[0] = 1 - yy - zz, O[1] = yx + wz,     O[2] = zx - wy,     
		O[3] = yx - wz,     O[4] = 1 - xx - zz, O[5] = zy + wx,     
		O[6] = zx + wy,     O[7] = zy - wx,     O[8] = 1 - xx - yy

		return O
	}

	this.mat3.normalFromMat4 = function( M, O ){
		if(!O) O = new Array(9)
		var m00 = M[0], m01 = M[1], m02 = M[2], m03 = M[3],
			m10 = M[4], m11 = M[5], m12 = M[6], m13 = M[7],
			m20 = M[8], m21 = M[9], m22 = M[10],m23 = M[11],
			m30 = M[12],m31 = M[13],m32 = M[14],m33 = M[15],
			b00 = m00 * m11 - m01 * m10, b01 = m00 * m12 - m02 * m10,
			b02 = m00 * m13 - m03 * m10, b03 = m01 * m12 - m02 * m11,
			b04 = m01 * m13 - m03 * m11, b05 = m02 * m13 - m03 * m12,
			b06 = m20 * m31 - m21 * m30, b07 = m20 * m32 - m22 * m30,
			b08 = m20 * m33 - m23 * m30, b09 = m21 * m32 - m22 * m31,
			b10 = m21 * m33 - m23 * m31, b11 = m22 * m33 - m23 * m32,
			d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

		if (!d) return null 
		d = 1.0 / dd

		O[0] = (m11 * b11 - m12 * b10 + m13 * b09) * d
		O[1] = (m12 * b08 - m10 * b11 - m13 * b07) * d
		O[2] = (m10 * b10 - m11 * b08 + m13 * b06) * d

		O[3] = (m02 * b10 - m01 * b11 - m03 * b09) * d
		O[4] = (m00 * b11 - m02 * b08 + m03 * b07) * d
		O[5] = (m01 * b08 - m00 * b10 - m03 * b06) * d

		O[6] = (m31 * b05 - m32 * b04 + m33 * b03) * d
		O[7] = (m32 * b02 - m30 * b05 - m33 * b01) * d
		O[8] = (m30 * b04 - m31 * b02 + m33 * b00) * de

		return O
	}



	// mat 4









	this.mat4 = function(  ){
		return Array.prototype.slice.call(arguments,0)
	}

	this.mat4.zero = function( O ){
		if(!O) O  = new Array(16)
		O[0] = O[1] = O[2] = O[3] =
		O[4] = O[5] = O[6] = O[7] = 
		O[8] = O[9] = O[10]= O[11]= 
		O[12]= O[13]= O[14]= O[15]= 0
		return O
	}

	this.mat4.identity = function( O ){
		if(!O) O = new Array(16)
		O[0] = 1, O[1] = 0, O[2] = 0, O[3] = 0,
		O[4] = 0, O[5] = 1, O[6] = 0, O[7] = 0,
		O[8] = 0, O[9] = 0, O[10]= 1, O[11]= 0,
		O[12]= 0, O[13]= 0, O[14]= 0, O[15]= 1
		return O
	}

	this.mat4.transpose = function( M, O ){
		if(!O) O = new Array(16)
		if (O === M) {
			var a01 = M[1], a02 = M[2], a03 = M[3], a12 = M[6], a13 = M[7], a23 = M[11]
			O[1] = M[4], O[2] = M[8], O[3] = M[12],O[4] = a01
			O[6] = M[9], O[7] = M[13],O[8] = a02,  O[9] = a12
			O[11]= M[14],O[12]= a03,  O[13]= a13,  O[14]= a23
		} 
		else {
			O[0] = M[0], O[1] = M[4], O[2] = M[8], O[3] = M[12]
			O[4] = M[1], O[5] = M[5], O[6] = M[9], O[7] = M[13]
			O[8] = M[2], O[9] = M[6], O[10]= M[10],O[11]= M[14]
			O[12]= M[3], O[13]= M[7], O[14]= M[11],O[15]= M[15]
		}
		return O;
	};

	// Invert matrix M
	this.mat4.invert = function( M, O ){
		if(!O) O = new Array(16)
		var a00 = M[0], a01 = M[1], a02 = M[2], a03 = M[3],
			a10 = M[4], a11 = M[5], a12 = M[6], a13 = M[7],
			a20 = M[8], a21 = M[9], a22 = M[10],a23 = M[11],
			a30 = M[12],a31 = M[13],a32 = M[14],a33 = M[15],

			b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
			b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
			b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
			b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
			b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
			b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32,

			d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06

		if (!d) return this.identity(O) 

		d = 1.0 / d
		O[0]  = (a11 * b11 - a12 * b10 + a13 * b09) * d
		O[1]  = (a02 * b10 - a01 * b11 - a03 * b09) * d
		O[2]  = (a31 * b05 - a32 * b04 + a33 * b03) * d
		O[3]  = (a22 * b04 - a21 * b05 - a23 * b03) * d
		O[4]  = (a12 * b08 - a10 * b11 - a13 * b07) * d
		O[5]  = (a00 * b11 - a02 * b08 + a03 * b07) * d
		O[6]  = (a32 * b02 - a30 * b05 - a33 * b01) * d
		O[7]  = (a20 * b05 - a22 * b02 + a23 * b01) * d
		O[8]  = (a10 * b10 - a11 * b08 + a13 * b06) * d
		O[9]  = (a01 * b08 - a00 * b10 - a03 * b06) * d
		O[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d
		O[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d
		O[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d
		O[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d
		O[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d
		O[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d
		return O
	}

	this.mat4.adjoint = function( M, O ) {
		var m00 = M[0], m01 = M[1], m02 = M[2], m03 = M[3],
			m10 = M[4], m11 = M[5], m12 = M[6], m13 = M[7],
			m20 = M[8], m21 = M[9], m22 = M[10],m23 = M[11],
			m30 = M[12],m31 = M[13],m32 = M[14],m33 = M[15]

		O[0]  =  (m11 * (m22 * m33 - m23 * m32) - m21 * (m12 * m33 - m13 * m32) + m31 * (m12 * m23 - m13 * m22))
		O[1]  = -(m01 * (m22 * m33 - m23 * m32) - m21 * (m02 * m33 - m03 * m32) + m31 * (m02 * m23 - m03 * m22))
		O[2]  =  (m01 * (m12 * m33 - m13 * m32) - m11 * (m02 * m33 - m03 * m32) + m31 * (m02 * m13 - m03 * m12))
		O[3]  = -(m01 * (m12 * m23 - m13 * m22) - m11 * (m02 * m23 - m03 * m22) + m21 * (m02 * m13 - m03 * m12))
		O[4]  = -(m10 * (m22 * m33 - m23 * m32) - m20 * (m12 * m33 - m13 * m32) + m30 * (m12 * m23 - m13 * m22))
		O[5]  =  (m00 * (m22 * m33 - m23 * m32) - m20 * (m02 * m33 - m03 * m32) + m30 * (m02 * m23 - m03 * m22))
		O[6]  = -(m00 * (m12 * m33 - m13 * m32) - m10 * (m02 * m33 - m03 * m32) + m30 * (m02 * m13 - m03 * m12))
		O[7]  =  (m00 * (m12 * m23 - m13 * m22) - m10 * (m02 * m23 - m03 * m22) + m20 * (m02 * m13 - m03 * m12))
		O[8]  =  (m10 * (m21 * m33 - m23 * m31) - m20 * (m11 * m33 - m13 * m31) + m30 * (m11 * m23 - m13 * m21))
		O[9]  = -(m00 * (m21 * m33 - m23 * m31) - m20 * (m01 * m33 - m03 * m31) + m30 * (m01 * m23 - m03 * m21))
		O[10] =  (m00 * (m11 * m33 - m13 * m31) - m10 * (m01 * m33 - m03 * m31) + m30 * (m01 * m13 - m03 * m11))
		O[11] = -(m00 * (m11 * m23 - m13 * m21) - m10 * (m01 * m23 - m03 * m21) + m20 * (m01 * m13 - m03 * m11))
		O[12] = -(m10 * (m21 * m32 - m22 * m31) - m20 * (m11 * m32 - m12 * m31) + m30 * (m11 * m22 - m12 * m21))
		O[13] =  (m00 * (m21 * m32 - m22 * m31) - m20 * (m01 * m32 - m02 * m31) + m30 * (m01 * m22 - m02 * m21))
		O[14] = -(m00 * (m11 * m32 - m12 * m31) - m10 * (m01 * m32 - m02 * m31) + m30 * (m01 * m12 - m02 * m11))
		O[15] =  (m00 * (m11 * m22 - m12 * m21) - m10 * (m01 * m22 - m02 * m21) + m20 * (m01 * m12 - m02 * m11))
		return O
	}

	// multiply matrix M with vector or matrix V
	this.mat4.mat4 = 
	this.mat4.mul = function( A, B, O ){
		if(!O) O = new Array(16)
		var a00 = A[0], a01 = A[1], a02 = A[2], a03 = A[3],
			a10 = A[4], a11 = A[5], a12 = A[6], a13 = A[7],
			a20 = A[8], a21 = A[9], a22 = A[10],a23 = A[11],
			a30 = A[12],a31 = A[13],a32 = A[14],a33 = A[15]

		var b0  = B[0], b1 = B[1], b2 = B[2], b3 = B[3]
		O[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30
		O[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31
		O[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32
		O[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33

		b0 = B[4], b1 = B[5], b2 = B[6], b3 = B[7]
		O[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30
		O[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31
		O[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32
		O[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33

		b0 = B[8], b1 = B[9], b2 = B[10], b3 = B[11]
		O[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30
		O[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31
		O[10]= b0*a02 + b1*a12 + b2*a22 + b3*a32
		O[11]= b0*a03 + b1*a13 + b2*a23 + b3*a33

		b0 = B[12], b1 = B[13], b2 = B[14], b3 = B[15]
		O[12]= b0*a00 + b1*a10 + b2*a20 + b3*a30
		O[13]= b0*a01 + b1*a11 + b2*a21 + b3*a31
		O[14]= b0*a02 + b1*a12 + b2*a22 + b3*a32
		O[15]= b0*a03 + b1*a13 + b2*a23 + b3*a33
		return O
	}

	// compute determinant of matrix M
	this.mat4.determinant = function( M ){
		var a00 = M[0], a01 = M[1], a02 = M[2], a03 = M[3],
			a10 = M[4], a11 = M[5], a12 = M[6], a13 = M[7],
			a20 = M[8], a21 = M[9], a22 = M[10],a23 = M[11],
			a30 = M[12],a31 = M[13],a32 = M[14],a33 = M[15],

			b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
			b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
			b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
			b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
			b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
			b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32

		// Calculate the determinant
		return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	}

	// translate matrix M with vector V
	this.mat4.translate = function( M, V, O ){
		if(!O) O = new Array(16)
		var x = V[0], y = V[1], z = V[2],
			a00, a01, a02, a03,
			a10, a11, a12, a13,
			a20, a21, a22, a23

		if (M === O) {
			O[12] = M[0] * x + M[4] * y + M[8] * z + M[12]
			O[13] = M[1] * x + M[5] * y + M[9] * z + M[13]
			O[14] = M[2] * x + M[6] * y + M[10] * z + M[14]
			O[15] = M[3] * x + M[7] * y + M[11] * z + M[15]
		} 
		else {
			a00 = M[0], a01 = M[1], a02 = M[2], a03 = M[3]
			a10 = M[4], a11 = M[5], a12 = M[6], a13 = M[7]
			a20 = M[8], a21 = M[9], a22 = M[10],a23 = M[11]

			O[0] = a00, O[1] = a01, O[2] = a02, O[3] = a03
			O[4] = a10, O[5] = a11, O[6] = a12, O[7] = a13
			O[8] = a20, O[9] = a21, O[10] = a22,O[11] = a23

			O[12] = a00 * x + a10 * y + a20 * z + M[12]
			O[13] = a01 * x + a11 * y + a21 * z + M[13]
			O[14] = a02 * x + a12 * y + a22 * z + M[14]
			O[15] = a03 * x + a13 * y + a23 * z + M[15]
		}

		return O
	}

	// scale matrix M with vector V
	this.mat4.scale = function( M, V, O ){
		if(!O) O = new Array(16)
		var x = V[0], y = V[1], z = V[2]

		O[0] = M[0] * x, O[1] = M[1] * x, O[2] = M[2] * x, O[3] = M[3] * x
		O[4] = M[4] * y, O[5] = M[5] * y, O[6] = M[6] * y, O[7] = M[7] * y
		O[8] = M[8] * z, O[9] = M[9] * z, O[10]= M[10]* z, O[11]= M[11] * z
		O[12]= M[12],    O[13]= M[13],    O[14]= M[14],    O[15]= M[15]
		return O
	}

	// rotate matrix M by angle A in radians around axis X
	this.mat4.rotate = function( M, A, X, O ){
		if(!O) O = new Array(16)
		var x = X[0], y = X[1], z = X[2],
			len = Math.sqrt(x * x + y * y + z * z),
			s = Math.sin(A), 
			c = Math.cos(A), 
			t = 1 - c,

		len = 1 / len
		x *= len, y *= len, z *= len

		if (Math.abs(len) < 0.000001) return null

		var a00 = M[0], a01 = M[1], a02 = M[2],  a03 = M[3],
			a10 = M[4], a11 = M[5], a12 = M[6],  a13 = M[7],
			a20 = M[8], a21 = M[9], a22 = M[10], a23 = M[11]

		// Construct the elements of the rotation matrix
		var b00 = x * x * t + c,     b01 = y * x * t + z * s, b02 = z * x * t - y * s,
			b10 = x * y * t - z * s, b11 = y * y * t + c,     b12 = z * y * t + x * s,
			b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c

		// Perform rotation-specific matrix multiplication
		O[0] = a00 * b00 + a10 * b01 + a20 * b02
		O[1] = a01 * b00 + a11 * b01 + a21 * b02
		O[2] = a02 * b00 + a12 * b01 + a22 * b02
		O[3] = a03 * b00 + a13 * b01 + a23 * b02
		O[4] = a00 * b10 + a10 * b11 + a20 * b12
		O[5] = a01 * b10 + a11 * b11 + a21 * b12
		O[6] = a02 * b10 + a12 * b11 + a22 * b12
		O[7] = a03 * b10 + a13 * b11 + a23 * b12
		O[8] = a00 * b20 + a10 * b21 + a20 * b22
		O[9] = a01 * b20 + a11 * b21 + a21 * b22
		O[10]= a02 * b20 + a12 * b21 + a22 * b22
		O[11]= a03 * b20 + a13 * b21 + a23 * b22

		if (M !== O) { // If the source and destination differ, copy the unchanged last row
			O[12] = M[12]
			O[13] = M[13]
			O[14] = M[14]
			O[15] = M[15]
		}
		return O
	}

	// Rotate matrix M by angle A around x-axis
	this.mat4.rotateX = function( M, A, O ){
		if(!O) O = new Array(16)
		var s = Math.sin(A), c = Math.cos(A),
			a10 = M[4], a11 = M[5], a12 = M[6], a13 = M[7],
			a20 = M[8], a21 = M[9], a22 = M[10], a23 = M[11]

		if (M !== O){ // If the source and destination differ, copy the unchanged rows
			O[0]  = M[0], O[1]  = M[1], O[2]  = M[2], O[3]  = M[3]
			O[12] = M[12],O[13] = M[13],O[14] = M[14],O[15] = M[15]
		}

		// Perform axis-specific matrix multiplication
		O[4] = a10 * c + a20 * s, O[5] = a11 * c + a21 * s
		O[6] = a12 * c + a22 * s, O[7] = a13 * c + a23 * s
		O[8] = a20 * c - a10 * s, O[9] = a21 * c - a11 * s
		O[10]= a22 * c - a12 * s, O[11]= a23 * c - a13 * s
		return O
	}

	// rotate matrix M with angle R around y-axis
	this.mat4.rotateY = function( M, A, O ){
		if(!O) O = new Array(16)
		var s = Math.sin(A), c = Math.cos(A),
			a00 = M[0], a01 = M[1], a02 = M[2], a03 = M[3],
			a20 = M[8], a21 = M[9], a22 = M[10], a23 = M[11]

		if (M !== O) { // If the source and destination differ, copy the unchanged rows
			O[4] = M[4],  O[5] = M[5],  O[6] = M[6],  O[7] = M[7]
			O[12]= M[12], O[13]= M[13], O[14]= M[14], O[15]= M[15]
		}

		// Perform axis-specific matrix multiplication
		O[0] = a00 * c - a20 * s, O[1] = a01 * c - a21 * s
		O[2] = a02 * c - a22 * s, O[3] = a03 * c - a23 * s
		O[8] = a00 * s + a20 * c, O[9] = a01 * s + a21 * c
		O[10]= a02 * s + a22 * c, O[11]= a03 * s + a23 * c
		return O
	}

	// rotate matrix M with angle R around z-axis
	this.mat4.rotateZ = function( M, A, O ){
		if(!O) O = new Array(16)
		var s = Math.sin(A), c = Math.cos(A),
			a00 = M[0], a01 = M[1], a02 = M[2], a03 = M[3],
			a10 = M[4], a11 = M[5], a12 = M[6], a13 = M[7]

		if (M !== O) { // If the source and destination differ, copy the unchanged last row
			O[8]  = M[8],  O[9]  = M[9],  O[10] = M[10], O[11] = M[11]
			O[12] = M[12], O[13] = M[13], O[14] = M[14], O[15] = M[15]
		}

		// Perform axis-specific matrix multiplication
		O[0] = a00 * c + a10 * s, O[1] = a01 * c + a11 * s
		O[2] = a02 * c + a12 * s, O[3] = a03 * c + a13 * s
		O[4] = a10 * c - a00 * s, O[5] = a11 * c - a01 * s
		O[6] = a12 * c - a02 * s, O[7] = a13 * c - a03 * s
		return O
	}

	// Create matrix from quaternion Q and translation V
	this.mat4.fromRT = function( Q, V, O ){
		if(!O) O = new Array(16)
		// Quaternion math
		var x = Q[0], y = Q[1], z = Q[2], w = Q[3],
			x2 = x + x,  y2 = y + y,  z2 = z + z,
			xx = x * x2, xy = x * y2, xz = x * z2,
			yy = y * y2, yz = y * z2, zz = z * z2,
			wx = w * x2, wy = w * y2, wz = w * z2

		O[0] = 1 - (yy + zz), O[1] = xy + wz,       O[2] = xz - wy,        O[3] = 0
		O[4] = xy - wz,       O[5] = 1 - (xx + zz), O[6] = yz + wx,        O[7] = 0
		O[8] = xz + wy,       O[9] = yz - wx,       O[10]= 1 - (xx + yy),  O[11]= 0
		O[12]= V[0],          O[13]= V[1],          O[14]= V[2],           O[15]= 1

		return O
	}

	// Create matrix from quaternion Q
	this.mat4.fromQuat = function( Q, O ){
		if(!O) O = new Array(16)
		var x = q[0], y = q[1], z = q[2], w = q[3],
			x2 = x + x,  y2 = y + y,  z2 = z + z,
			xx = x * x2, yx = y * x2, yy = y * y2,
			zx = z * x2, zy = z * y2, zz = z * z2,
			wx = w * x2, wy = w * y2, wz = w * z2

		O[0] = 1 - yy - zz, O[1] = yx + wz,     O[2] = zx - wy,      O[3] = 0
		O[4] = yx - wz,     O[5] = 1 - xx - zz, O[6] = zy + wx,      O[7] = 0
		O[8] = zx + wy,     O[9] = zy - wx,     O[10]= 1 - xx - yy,  O[11]= 0
		O[12]= 0,           O[13]= 0,           O[14]= 0,            O[15]= 1

		return O
	}
	
	// Create matrix from left/right/bottom/top/near/far
	this.mat4.frustum = function( L, R, B, T, N, F, O ){
		if(!O) O = new Array(16)
		var rl = 1 / (R - L), tb = 1 / (T - B), nf = 1 / (N - F)

		O[0] = (N * 2) * rl, O[1] = 0,            O[2] = 0,                O[3] = 0
		O[4] = 0,            O[5] = (N * 2) * tb, O[6] = 0,                O[7] = 0
		O[8] = (R + L) * rl, O[9] = (T + B) * tb, O[10]= (F + N) * nf,     O[11]= -1
		O[12]= 0,            O[13]= 0,            O[14]= (F * N * 2) * nf, O[15]= 0

		return O
	}

	// Create perspective matrix FovY, Aspect, Near, Far
	this.mat4.perspective = function( FY, A, N, F, O ){
		if(!O) O = new Array(16)
		var f = 1.0 / Math.tan(FY / 2), nf = 1 / (N - F)

		O[0] = f / A, O[1] = 0,  O[2] = 0,                 O[3] = 0
		O[4] = 0,     O[5] = f,  O[6] = 0,                 O[7] = 0
		O[8] = 0,     O[9] = 0,  O[10] = (F + N) * nf,     O[11]= -1
		O[12]= 0,     O[13]= 0,  O[14] = (2 * F * N) * nf, O[15]= 0

		return O
	}

	// Create orthogonal proj matrix with Left/Right/Bottom/Top/Near/Far
	this.mat4.ortho = function( L, R, B, T, N, F, O ){
		if(!O) O = new Array(16)
		var lr = 1 / (L - R), bt = 1 / (B - T), nf = 1 / (N - F)

		O[0] = -2 * lr,      O[1] = 0,            O[2] = 0,            O[3] = 0 
		O[4] = 0,            O[5] = -2 * bt,      O[6] = 0,            O[7] = 0 
		O[8] = 0,            O[9] = 0,            O[10]= 2 * nf,       O[11]= 0
		O[12]= (L + R) * lr, O[13]= (T + B) * bt, O[14]= (F + N) * nf, O[15]= 1

		return O
	}

	// Create look at matrix with Eye, LookAt, and Up vectors 
	this.mat4.lookAt = function( E, L, U, O ){
		var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
			ex = E[0], ey = E[1], ez = E[2],
			ux = U[0], uy = U[1], uz = U[2],
			lx = L[0], ly = L[1], lz = L[2]

		if (Math.abs(ex - lx) < 0.000001 &&
			Math.abs(ey - ly) < 0.000001 &&
			Math.abs(ez - lz) < 0.000001) {
			return this.identity(O)
		}

		z0 = ex - lx, z1 = ey - ly, z2 = ez - lz
		len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2)
		z0 *= len, z1 *= len, z2 *= len

		x0 = uy * z2 - uz * z1, x1 = uz * z0 - ux * z2, x2 = ux * z1 - uy * z0
		len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2)
		if (!len) {
			x0 = 0, x1 = 0, x2 = 0
		} 
		else {
			len = 1 / len
			x0 *= len, x1 *= len, x2 *= len
		}

		y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0

		len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2)
		if (!len) {
			y0 = 0, y1 = 0, y2 = 0
		} 
		else {
			len = 1 / len
			y0 *= len, y1 *= len, y2 *= len
		}

		O[0] = x0, O[1] = y0, O[2] = z0,  O[3] = 0
		O[4] = x1, O[5] = y1, O[6] = z1,  O[7] = 0
		O[8] = x2, O[9] = y2, O[10] = z2, O[11] = 0
		O[12] = -(x0 * ex + x1 * ey + x2 * ez)
		O[13] = -(y0 * ex + y1 * ey + y2 * ez)
		O[14] = -(z0 * ex + z1 * ey + z2 * ez)
		O[15] = 1
		return O
	}







	// quat 








	this.quat = function( x, y, z, w ){
		return [x, y, z, w]
	}

	this.quat.identity = function( O ){
		if(!O) O = new Array(4)
		O[0] = O[1] = O[2] = 0, O[3] = 1
		return O
	}

	this.quat.rotationTo = (function(vec3) {
		var T = vec3.zero()
		var X = vec3(1,0,0)
		var Y = vec3(0,1,0)
		// Shortest rotation path from quat A to quat B
		return function( A, B, O ) {
			if(!O) O = new Array(4)
			var dot = vec3.dot( A, B )
			if (dot < -0.999999) {
				vec3.cross(X, A, T)
				if (vec3.length(T) < 0.000001) vec3.cross(Y, A, T)
				vec3.normalize(T, T)
				quat.setAxisAngle(T, Math.PI, O)
				return O
			} else if (dot > 0.999999) {
				O[0] = 0, O[1] = 0, O[2] = 0, O[3] = 1
				return O
			} else {
				vec3.cross(A, B, T)
				O[0] = T[0], O[1] = T[1], O[2] = T[2], O[3] = 1 + dot
				return quat.normalize(O, O)
			}
		}
	})(this.vec3)

	this.quat.setAxes = (function(mat3) {
		var M = mat3.zero()
		// create quaternion from Viewing direction, local Right and local Up
		return function( V, R, U, O ) {
			if(!O) O = new Array(4)
			M[0] = R[0], M[1] = U[0], M[2] = -V[0]
			M[3] = R[1], M[4] = U[1], M[5] = -V[1]
			M[6] = R[2], M[7] = U[2], M[8] = -V[2]
			return this.normalize( this.fromMat3(M, O))
		};
	})(this.mat3)

	// quaternion around aXis, with rotation Angle
	this.quat.setAxisAngle = function( X, A, O ) {
		if(!O) O = new Array(4)
		A = A * 0.5
		var s = Math.sin(A)
		O[0] = s * X[0], O[1] = s * X[1], O[2] = s * X[2], O[3] = Math.cos(A)
		return O
	}

	this.quat.add = this.vec4.add

	this.quat.mul = function( A, B, O ){
		if(!O) O = new Array(4)
		var ax = A[0], ay = A[1], az = A[2], aw = A[3],
			bx = B[0], by = B[1], bz = B[2], bw = B[3]

		O[0] = ax * bw + aw * bx + ay * bz - az * by
		O[1] = ay * bw + aw * by + az * bx - ax * bz
		O[2] = az * bw + aw * bz + ax * by - ay * bx
		O[3] = aw * bw - ax * bx - ay * by - az * bz
		return O
	}

	// rotate quaternion Q with angle A around x axis
	this.quat.rotateX = function( Q, A, O ){
		if(!O) O = new Array(4)
		A *= 0.5;
		var ax = Q[0], ay = Q[1], az = Q[2], aw = Q[3],
		    bx = Math.sin(A), bw = Math.cos(A)

		O[0] = ax * bw + aw * bx
		O[1] = ay * bw + az * bx
		O[2] = az * bw - ay * bx
		O[3] = aw * bw - ax * bx
		return O
	};

	// rotate quaternion Q with angle A around y axis
	this.quat.rotateY = function( Q, A, O ){
		if(!O) O = new Array(4)
		A *= 0.5
		var ax = Q[0], ay = Q[1], az = Q[2], aw = Q[3],
			by = Math.sin(rad), bw = Math.cos(rad)

		O[0] = ax * bw - az * by
		O[1] = ay * bw + aw * by
		O[2] = az * bw + ax * by
		O[3] = aw * bw - ay * by
		return O
	}

	// rotate quaternion Q with angle A around z axis
	this.quat.rotateZ = function( Q, A, O ){
		if(!O) O = new Array(4)
		A *= 0.5

		var ax = Q[0], ay = Q[1], az = Q[2], aw = Q[3],
			bz = Math.sin(rad), bw = Math.cos(rad)

		O[0] = ax * bw + ay * bz
		O[1] = ay * bw - ax * bz
		O[2] = az * bw + aw * bz
		O[3] = aw * bw - az * bz
		return O
	}

	// Calculate w from xyz
	this.quat.calculateW = function( Q, O ){
		if(!O) O = new Array(4)
		var x = Q[0], y = Q[1], z = Q[2]

		O[0] = x
		O[1] = y
		O[2] = z
		O[3] = -Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z))
		return O
	}
	
	this.quat.dot = this.vec4.dot;
	this.quat.mix = this.vec4.mix

	// spherelical linear interpolation between quat A and B with f (0-1)
	this.quat.slerp = function( A, B, f, O ){
		if(!O) O = new Array(4)

		var ax = A[0], ay = A[1], az = A[2], aw = A[3],
			bx = B[0], by = B[1], bz = B[2], bw = B[3]

		var omega, cosom, sinom, scale0, scale1;

		// calc cosine
		cosom = ax * bx + ay * by + az * bz + aw * bw
		// adjust signs (if necessary)
		if ( cosom < 0.0 ) {
			cosom = -cosom
			bx = - bx, by = - by, bz = - bz, bw = - bw
		}
		// calculate coefficients
		if ( (1.0 - cosom) > 0.000001 ) {
			// standard case (slerp)
			omega  = Math.acos(cosom)
			sinom  = Math.sin(omega)
			scale0 = Math.sin((1.0 - f) * omega) / sinom
			scale1 = Math.sin(f * omega) / sinom
		} 
		else { // linear interpolate if very close
			scale0 = 1.0 - f;
			scale1 = f;
		}
		// calculate final values
		O[0] = scale0 * ax + scale1 * bx
		O[1] = scale0 * ay + scale1 * by
		O[2] = scale0 * az + scale1 * bz
		O[3] = scale0 * aw + scale1 * bw
		return O
	}

	// invert Q
	this.quat.invert = function( Q, O ){
		if(!O) O = new Array(4)
		var a0 = Q[0], a1 = Q[1], a2 = Q[2], a3 = Q[3],
			d = a0*a0 + a1*a1 + a2*a2 + a3*a3,
			i = d ? 1.0/d : 0
		
		O[0] = -a0*i, O[1] = -a1*i, O[2] = -a2*i, O[3] = a3*i
		return O
	};

	// Calculates the conjugate of quat Q
	// If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
	this.quat.conjugate = function( Q, O ){
		if(!O) O = new Array(4)
		O[0] = -Q[0], O[1] = -Q[1], O[2] = -Q[2], O[3] = Q[3]
		return O
	}

	this.quat.len = this.vec4.len
	this.quat.normalize = this.vec4.normalize;

	this.quat.fromMat3 = function( M, O ){
		// Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
		// article "Quaternion Calculus and Fast Animation".
		var T = M[0] + M[4] + M[8], R

		if ( T > 0.0 ) {
			// |w| > 1/2, may as well choose w > 1/2
			R = Math.sqrt(T + 1.0)  // 2w
			O[3] = 0.5 * R
			R = 0.5/R  // 1/(4w)
			O[0] = (M[5]-M[7])*R, O[1] = (M[6]-M[2])*R, O[2] = (M[1]-M[3])*R
		} 
		else {
			// |w| <= 1/2
			var i = 0;
			if ( M[4] > M[0] ) i = 1
			if ( M[8] > M[i*3+i] ) i = 2;
			var j = (i+1)%3
			var k = (i+2)%3
			
			R = Math.sqrt(M[i*3+i]-M[j*3+j]-M[k*3+k] + 1.0)
			O[i] = 0.5 * R
			R = 0.5 / R
			O[3] = (M[j*3+k] - M[k*3+j]) * R, O[j] = (M[j*3+i] + M[i*3+j]) * R, O[k] = (M[k*3+i] + M[i*3+k]) * R;
		}
		return O
	}
}