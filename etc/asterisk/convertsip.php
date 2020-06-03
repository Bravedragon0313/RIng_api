<?php

$con = mysqli_connect("localhost","sigman","sigman","sigman");
if ($con->connect_error) {
    die("Connection failed: " . $con->connect_error);
	exit();
}


$sql = "SELECT * FROM `ast_config` WHERE `filename` = 'sip.conf' AND `category` != 'general' order by cat_metric,var_metric";


$result = mysqli_query($con, $sql) or die(mysqli_error($con));

unlink("./output.txt");
$file = "./output.txt";

if (mysqli_num_rows($result) > 0) {
    $cm = "0";
    while($row = mysqli_fetch_assoc($result)) {
		if($row['cat_metric'] != $cm){
      $category = "\n" . "[" . $row['category'] . "] \n" ;
      file_put_contents($file, $category, FILE_APPEND);
      $cm = $row['cat_metric'];
		}
		
		$var_val = $row['var_name']. " = " . $row['var_val'] . "\n" ;
		file_put_contents($file, $var_val, FILE_APPEND);
		

	}
	
	echo "Done Withour Errors";
}


?>
